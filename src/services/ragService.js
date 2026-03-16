const { promptBuilder } = require("../utils/promptBuilder");
const { vectorRepository } = require("../repositories/vectorRepository");
const cache = require("../utils/lruCache");

let ollamaHealthCache = { ok: true, checkedAt: 0, message: "" };

async function answerQuestion(question, history = []) {
  const greeting = detectGreeting(question);
  if (greeting) {
    return greeting;
  }
  const cacheTtl = parseInt(process.env.Q_CACHE_TTL_MS || "600000", 10);
  // cache keys: prefer session-aware key, but also support question-only hits
  const historyText = formatHistory(history);
  const questionKey = normalizeText(question);
  const sessionKey = `${questionKey}|${historyText}`;

  // 1) try session-aware cache (most precise)
  const sessionCached = cache.get(sessionKey);
  if (sessionCached) return sessionCached;

  // 2) try question-only cache as a fast fallback (useful when history changes)
  const questionCached = cache.get(questionKey);
  if (questionCached) return questionCached;

  const docs = await vectorRepository.search(question, 3);
  const hasDocs = docs && docs.length > 0;

  if (!hasDocs) {
    return formatAnswer("Nao encontrei essa informacao na documentacao.");
  }

  const model = process.env.OLLAMA_MODEL || "llama3";
  const url = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
  const apiKey =
    process.env.OLLAMA_API_KEY || process.env.LLAMA_CLOUD_KEY || "";
  // Limita a quantidade de documentos e tamanho do contexto
  const topDocs = docs.slice(0, 4); // apenas os docs mais relevantes
  let rawContext = topDocs
    .map((d) => `Fonte: ${d.source}\n${d.content}`)
    .join("\n\n");
  // Limita o contexto a no máximo 7000 caracteres
  if (rawContext.length > 7000) {
    rawContext = rawContext.slice(0, 7000) + "...";
  }
  const focusedContext = extractRelevantText(rawContext, question);
  const ollamaOk = await checkOllamaHealth(url, apiKey);
  if (!ollamaOk) {
    return formatAnswer(fallbackAnswer());
  }

  if (!focusedContext || focusedContext.trim().length === 0) {
    return formatAnswer("Nao encontrei essa informacao na documentacao.");
  }

  const shouldUseFull = shouldUseFullContext(question);
  const summarizedContext = shouldUseFull
    ? focusedContext
    : await summarizeContext({
        context: focusedContext,
        question,
        historyText,
        model,
        url,
        apiKey,
      });
  const prompt = promptBuilder({
    context: summarizedContext,
    question,
    historyText,
  });

  try {
    const temperature = Number(process.env.LLM_TEMPERATURE || 0.7);
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    logUsage(data);
    const text = data && data.response ? String(data.response).trim() : "";

    if (text.length > 0) {
      const out = formatAnswer(text);
      try {
        // set both session-aware and question-only caches to improve repeated-query latency
        try {
          cache.set(sessionKey, out, cacheTtl);
        } catch (e) {
          /* ignore */
        }
        try {
          cache.set(questionKey, out, cacheTtl);
        } catch (e) {
          /* ignore */
        }
      } catch (e) {
        // ignore outer cache errors
      }
      return out;
    }
  } catch (err) {
    console.warn("Ollama unavailable, using fallback:", err.message || err);
  }

  return formatAnswer(fallbackAnswer());
}

async function checkOllamaHealth(url, apiKey) {
  const now = Date.now();
  if (now - ollamaHealthCache.checkedAt < 30_000) {
    return ollamaHealthCache.ok;
  }

  const healthUrl = buildOllamaHealthUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });
    ollamaHealthCache = {
      ok: response.ok,
      checkedAt: now,
      message: response.ok ? "" : `HTTP ${response.status}`,
    };
    if (!response.ok) {
      console.warn(
        `Ollama healthcheck failed: ${healthUrl} ${response.status}`,
      );
    }
    return response.ok;
  } catch (err) {
    ollamaHealthCache = {
      ok: false,
      checkedAt: now,
      message: err.message || String(err),
    };
    console.warn(`Ollama healthcheck failed: ${healthUrl}`, err.message || err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function buildOllamaHealthUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/api/tags`;
  } catch {
    return "http://localhost:11434/api/tags";
  }
}

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shouldUseFullContext(question) {
  const q = normalizeText(question || "");
  if (!q) return false;
  const asksHow =
    q.includes("como") ||
    q.includes("passo a passo") ||
    q.includes("passo-a-passo") ||
    q.includes("etapas") ||
    q.includes("processo");

  const actionVerb =
    q.includes("criar") ||
    q.includes("criar") ||
    q.includes("criar") ||
    q.includes("excluir") ||
    q.includes("remover") ||
    q.includes("editar") ||
    q.includes("alterar") ||
    q.includes("configurar") ||
    q.includes("vincular") ||
    q.includes("adicionar");

  return asksHow || actionVerb;
}

function detectGreeting(question) {
  const q = normalizeText(question).trim();
  const greetings = [
    "oi",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
    "e ai",
    "hello",
    "hi",
    "hey",
  ];

  for (const g of greetings) {
    if (
      q === g ||
      q.startsWith(g + " ") ||
      q.endsWith(" " + g) ||
      q.includes(g)
    ) {
      return "Ola! Posso ajudar com alguma informacao da documentacao?";
    }
  }

  return "";
}

function formatHistory(history) {
  if (!history || history.length === 0) return "";
  return history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "Usuario" : "Assistente"}: ${m.content}`)
    .join("\n");
}

function fallbackAnswer() {
  return "Nao consegui gerar um resumo da documentacao. Pode reformular a pergunta?";
}

function formatAnswer(text) {
  const withoutImages = removeImages(text);
  return withoutImages;
}

function extractRelevantText(context, question) {
  if (!context) return context;
  const q = normalizeText(question);
  const terms = q.split(/\s+/).filter((t) => t.length >= 4);
  if (terms.length === 0) return context;

  const blocks = context.split(/\n{2,}/);
  const scored = blocks
    .map((block) => {
      const norm = normalizeText(block);
      let score = 0;
      terms.forEach((t) => {
        if (norm.includes(t)) score += 1;
      });
      return { block, score };
    })
    .filter((b) => b.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || blocks.length <= 1) {
    return extractLineWindows(context, terms) || context;
  }
  return scored
    .slice(0, 5)
    .map((b) => b.block)
    .join("\n\n");
}

function buildFallbackAnswer({ context, question }) {
  if (!context || context.trim().length === 0) return "";

  const required = extractRequiredForCreation(context, question);
  if (required) return required;

  const keywordAnswer = extractAnswerByKeywords(context, question);
  if (keywordAnswer) return keywordAnswer;

  const targeted = extractBulletsForQuestion(context, question);
  if (targeted.length > 0) {
    return ["Campos obrigatorios (aba Turmas):", ...targeted].join("\n");
  }

  const trimmed = context.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function extractBullets(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function extractBulletsForQuestion(context, question) {
  const cleaned = context
    .split("\n")
    .filter((line) => !line.trim().startsWith("Fonte:"))
    .join("\n");

  const q = normalizeText(question || "");
  const wantsRequired = q.includes("campo") && q.includes("obrigatorio");

  if (wantsRequired) {
    const norm = normalizeText(cleaned);
    const idx = norm.indexOf("campos obrigatorios");
    if (idx >= 0) {
      const tail = cleaned.slice(idx);
      const bullets = extractBullets(tail);
      if (bullets.length > 0) return bullets.slice(0, 12);
    }
  }

  const bullets = extractBullets(cleaned);
  return bullets.slice(0, 12);
}

function extractAnswerByKeywords(context, question) {
  const q = normalizeText(question || "");
  if (!q) return "";

  const wantsFormat =
    q.includes("formato") ||
    q.includes("arquivo") ||
    q.includes("planilha") ||
    q.includes("csv") ||
    q.includes("xlsx");

  if (!wantsFormat) return "";

  const cleaned = context
    .split("\n")
    .filter((line) => !line.trim().startsWith("Fonte:"))
    .join(" ");

  const sentences = cleaned
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hits = sentences.filter((s) => {
    const ns = normalizeText(s);
    return (
      ns.includes("formato") ||
      ns.includes("csv") ||
      ns.includes("xlsx") ||
      ns.includes("planilha") ||
      ns.includes("arquivo")
    );
  });

  if (hits.length === 0) return "";

  const out = hits.slice(0, 3).join(". ");
  return out.endsWith(".") ? out : `${out}.`;
}

function extractRequiredForCreation(context, question) {
  const q = normalizeText(question || "");
  if (
    !(q.includes("obrigatorio") && q.includes("criacao") && q.includes("turma"))
  ) {
    return "";
  }

  const lines = context
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const markerIdx = lines.findIndex((l) =>
    normalizeText(l).includes("obrigatorio para criacao da turma"),
  );
  if (markerIdx < 0) return "";

  // Walk backwards to find the field name line
  for (let i = markerIdx - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (/^[a-z_]+$/.test(line)) {
      return `Obrigatorio para criacao da turma: ${line}`;
    }
  }

  return lines[markerIdx];
}

function extractLineWindows(context, terms) {
  const lines = context.split("\n");
  const hits = new Set();

  lines.forEach((line, idx) => {
    const norm = normalizeText(line);
    for (const t of terms) {
      if (norm.includes(t)) {
        for (
          let i = Math.max(0, idx - 3);
          i <= Math.min(lines.length - 1, idx + 3);
          i += 1
        ) {
          hits.add(i);
        }
        break;
      }
    }
  });

  if (hits.size === 0) return "";
  return Array.from(hits)
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .join("\n")
    .trim();
}

async function summarizeContext({
  context,
  question,
  historyText,
  model,
  url,
  apiKey,
}) {
  if (!context || context.trim().length === 0) return context;

  const prompt = [
    "Responda a pergunta com base na documentacao abaixo.",
    "Seja objetivo, mas inclua detalhes quando forem necessarios.",
    "Nao copie trechos da documentacao; extraia apenas a resposta final.",
    "Se houver passos, liste somente os passos necessarios.",
    "Nao invente informacoes.",
    "Se possivel, responda em formato de lista ou tabela.",
    "adicione um emogi relevante no início do resumo para destacar a resposta.",
    "",
    "HISTORICO:",
    historyText || "Sem historico.",
    "",
    "PERGUNTA:",
    question || "",
    "",
    "DOCUMENTACAO:",
    context,
  ].join("\n");

  try {
    const temperature = Number(process.env.LLM_TEMPERATURE || 0.7);
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    logUsage(data);
    const text = data && data.response ? String(data.response).trim() : "";
    if (text.length === 0) return context;
    if (text.length >= context.length * 0.8) {
      return extractRelevantText(context, question);
    }
    return text;
  } catch (err) {
    console.warn(
      "Resumo indisponivel, usando contexto completo:",
      err.message || err,
    );
    return context;
  }
}

async function condenseAnswer({
  answer,
  question,
  historyText,
  model,
  url,
  apiKey,
}) {
  if (!answer || answer.length <= 900) return answer;

  const prompt = [
    "Reescreva a resposta abaixo de forma objetiva, curta e direta.",
    "Mantenha apenas o que o usuario deve fazer.",
    "Se houver passos, limite a no maximo 6 itens.",
    "Nao invente informacoes.",
    "",
    "HISTORICO:",
    historyText || "Sem historico.",
    "",
    "PERGUNTA:",
    question || "",
    "",
    "RESPOSTA ATUAL:",
    answer,
  ].join("\n");

  try {
    const temperature = Number(process.env.LLM_TEMPERATURE || 0.7);
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    logUsage(data);
    const text = data && data.response ? String(data.response).trim() : "";
    return text.length > 0 ? text : answer;
  } catch (err) {
    console.warn(
      "Condensacao indisponivel, usando resposta original:",
      err.message || err,
    );
    return answer;
  }
}

function removeImages(text) {
  let out = text;
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  out = out.replace(/<img\s+[^>]*>/gi, "");
  return out;
}

function buildHeaders(apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function logUsage(data) {
  if (!data || typeof data !== "object") return;
  const prompt =
    typeof data.prompt_eval_count === "number" ? data.prompt_eval_count : null;
  const evalCount =
    typeof data.eval_count === "number" ? data.eval_count : null;
  const total =
    typeof data.total_duration === "number" ? data.total_duration : null;
  const load =
    typeof data.load_duration === "number" ? data.load_duration : null;
  const promptDur =
    typeof data.prompt_eval_duration === "number"
      ? data.prompt_eval_duration
      : null;
  const evalDur =
    typeof data.eval_duration === "number" ? data.eval_duration : null;

  if (prompt === null && evalCount === null && total === null) return;

  const parts = [];
  if (prompt !== null) parts.push(`prompt_tokens=${prompt}`);
  if (evalCount !== null) parts.push(`output_tokens=${evalCount}`);
  if (total !== null) parts.push(`total_ms=${Math.round(total / 1e6)}`);
  if (load !== null) parts.push(`load_ms=${Math.round(load / 1e6)}`);
  if (promptDur !== null)
    parts.push(`prompt_ms=${Math.round(promptDur / 1e6)}`);
  if (evalDur !== null) parts.push(`eval_ms=${Math.round(evalDur / 1e6)}`);

  if (parts.length > 0) {
    console.info(`LLM usage: ${parts.join(" ")}`);
  }
}

module.exports = { ragService: { answerQuestion } };
