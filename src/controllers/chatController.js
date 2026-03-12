const { ragService } = require("../services/ragService");

const sessions = new Map();
const MAX_HISTORY = 20;

function getSessionId(req) {
  const headerId = req.headers["x-session-id"];
  if (headerId) return String(headerId);
  if (req.body && req.body.sessionId) return String(req.body.sessionId);
  return "default";
}

async function chatController(req, res) {
  const question =
    req.body && req.body.question ? String(req.body.question) : "";

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: "Pergunta obrigatoria." });
  }

  if (question.length > 800) {
    return res.status(413).json({ error: "Pergunta muito longa." });
  }

  const sessionId = getSessionId(req);
  const history = sessions.get(sessionId) || [];

  try {
    const answer = await ragService.answerQuestion(question.trim(), history);

    history.push({ role: "user", content: question.trim() });
    history.push({ role: "assistant", content: answer });

    if (history.length > MAX_HISTORY * 2) {
      history.splice(0, history.length - MAX_HISTORY * 2);
    }

    sessions.set(sessionId, history);

    return res.json({ answer, sessionId });
  } catch (err) {
    console.error("chatController error:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}

module.exports = { chatController };
