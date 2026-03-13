require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const pdfParse = require("pdf-parse");
const { createCanvas } = require("canvas");
const { createWorker } = require("tesseract.js");
const { chunkTextWithOverlap, chunkText } = require("../utils/chunking");
const { embeddingService } = require("../services/embeddingService");
let faiss = null;
let IndexClass = null;
try {
  const _faiss = require("faiss-node");
  faiss = _faiss;
  // pick a flat index class available in this binding
  IndexClass =
    _faiss.IndexFlatIP ||
    _faiss.IndexFlatL2 ||
    _faiss.IndexFlat ||
    _faiss.Index ||
    null;
} catch (err) {
  console.warn(
    "faiss-node not available:",
    err && err.message ? err.message : err,
  );
}

// Global handlers to capture unexpected terminations and log stacks
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err && err.stack ? err.stack : err);
});
process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled rejection:",
    reason && reason.stack ? reason.stack : reason,
  );
});

const DOCS_DIR = path.join(__dirname, "..", "..", "docs");
const OUT_PATH = path.join(__dirname, "..", "..", "data", "index.json");
const OUT_FAISS = path.join(__dirname, "..", "..", "data", "index.faiss");

const OCR_ENABLED = (process.env.OCR_PDF || "true").toLowerCase() === "true";
const OCR_ENGINE = (process.env.OCR_ENGINE || "pdfjs").toLowerCase();
const OCR_LANG = process.env.OCR_LANG || "por";
const OCR_SCALE = Number(process.env.OCR_SCALE || 2.0);
const EMBED_BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE || 32);
const CHUNK_WORDS = Number(process.env.CHUNK_WORDS || 250);
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || 0.2);

function listDocs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (f) => f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".pdf"),
    )
    .map((f) => path.join(dir, f));
}

function ensureOutDir() {
  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

async function readDoc(filePath) {
  const title = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(buffer);
    let content = parsed.text || "";

    if (OCR_ENABLED) {
      const ocrText = await tryOcr(buffer, filePath);
      if (ocrText.trim().length > 0) {
        content = `${content}\n\n[OCR]\n${ocrText}`.trim();
      }
    }

    return { title, content };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return { title, content: raw };
}

async function tryOcr(buffer, filePath) {
  try {
    if (OCR_ENGINE === "external") {
      return ocrPdfExternal(filePath);
    }
    return await ocrPdfPdfjs(buffer);
  } catch (err) {
    console.warn("OCR falhou, continuando sem OCR:", err.message || err);
    return "";
  }
}

async function ocrPdfPdfjs(buffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const standardFontsPath = path.join(
    __dirname,
    "..",
    "..",
    "node_modules",
    "pdfjs-dist",
    "standard_fonts",
  );
  if (fs.existsSync(standardFontsPath)) {
    pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = pathToFileURL(
      standardFontsPath + path.sep,
    ).href;
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const worker = await createWorker(OCR_LANG);

  const CanvasFactory = {
    create(width, height) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      return { canvas, context };
    },
    reset(target, width, height) {
      target.canvas.width = width;
      target.canvas.height = height;
    },
    destroy(target) {
      target.canvas.width = 0;
      target.canvas.height = 0;
      target.canvas = null;
      target.context = null;
    },
  };

  let out = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const target = CanvasFactory.create(viewport.width, viewport.height);

      await page.render({
        canvasContext: target.context,
        viewport,
        canvasFactory: CanvasFactory,
      }).promise;
      const img = target.canvas.toBuffer("image/png");

      const { data } = await worker.recognize(img);
      const text = data && data.text ? String(data.text).trim() : "";
      if (text.length > 0) {
        out += `\n\n[OCR Pagina ${pageNum}]\n${text}`;
      }

      CanvasFactory.destroy(target);
    } catch (err) {
      console.warn(`OCR falhou na pagina ${pageNum}:`, err.message || err);
    }
  }

  await worker.terminate();
  return out.trim();
}

function ocrPdfExternal(filePath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aihelp-ocr-"));
  const prefix = path.join(tmpDir, "page");

  // Requires poppler (pdftoppm) and tesseract installed in PATH
  execFileSync("pdftoppm", ["-png", filePath, prefix], { stdio: "ignore" });

  const images = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
    .map((f) => path.join(tmpDir, f))
    .sort();

  let out = "";
  images.forEach((imgPath, idx) => {
    const text = execFileSync(
      "tesseract",
      [imgPath, "stdout", "-l", OCR_LANG],
      { encoding: "utf8" },
    );
    const cleaned = String(text || "").trim();
    if (cleaned.length > 0) {
      out += `\n\n[OCR Pagina ${idx + 1}]\n${cleaned}`;
    }
  });

  // cleanup
  images.forEach((p) => fs.unlinkSync(p));
  fs.rmdirSync(tmpDir);

  return out.trim();
}

async function buildDocs() {
  const files = listDocs(DOCS_DIR);
  const docs = [];

  for (const file of files) {
    const { title, content } = await readDoc(file);
    const rawChunks = chunkTextWithOverlap(content, CHUNK_WORDS, CHUNK_OVERLAP);

    rawChunks.forEach((c) => {
      docs.push({
        id: `${title}#${c.index}`,
        source: title,
        content: c.text,
        meta: {
          startWord: c.startWord,
          endWord: c.endWord,
        },
      });
    });
  }

  return docs;
}

async function buildEmbeddings(docs) {
  if (!docs || docs.length === 0) return [];
  const vectors = [];

  for (let i = 0; i < docs.length; i += EMBED_BATCH_SIZE) {
    const batch = docs.slice(i, i + EMBED_BATCH_SIZE).map((d) => d.content);
    const batchVectors = await embeddingService.embedBatch(batch);
    if (!Array.isArray(batchVectors) || batchVectors.length !== batch.length) {
      throw new Error("Falha ao gerar embeddings do batch.");
    }
    vectors.push(...batchVectors);
  }

  return vectors;
}

async function main() {
  try {
    ensureOutDir();
    const docs = await buildDocs();
    const embeddings = await buildEmbeddings(docs);

    // attach embeddings to docs for JSON storage and JS search fallback
    if (Array.isArray(embeddings) && embeddings.length === docs.length) {
      for (let i = 0; i < docs.length; i += 1) {
        docs[i].meta = docs[i].meta || {};
        docs[i].meta.embedding = embeddings[i];
      }
    }

    if (docs.length === 0) {
      fs.writeFileSync(
        OUT_PATH,
        JSON.stringify({ meta: {}, docs: [] }, null, 2),
      );
      console.log("Nenhum documento encontrado para indexar.");
      return;
    }

    const dims = embeddings[0] ? embeddings[0].length : 0;
    if (!dims) {
      throw new Error("Embedding invalido: dimensoes vazias.");
    }

    // Optionally create FAISS index if explicitly enabled and faiss-node is available
    if (faiss && process.env.ENABLE_FAISS === "true" && IndexClass) {
      try {
        console.log(
          "FAISS: ENABLE_FAISS=true and faiss-node available. Preparing index creation.",
        );
        console.log(
          "FAISS: Index class:",
          IndexClass && IndexClass.name ? IndexClass.name : String(IndexClass),
        );
        console.log("FAISS: dims=", dims, "count=", docs.length);

        const index = new IndexClass(dims);

        // flatten and convert to Float32Array which most bindings expect
        const flat = embeddings.flat();
        const floatArr = Float32Array.from(flat);

        // Try calling different possible signatures for add
        try {
          // common: index.add(Float32Array)
          index.add(floatArr);
          console.log("FAISS: index.add(floatArr) succeeded");
        } catch (addErr1) {
          console.warn(
            "FAISS: index.add(floatArr) failed:",
            addErr1 && addErr1.message ? addErr1.message : addErr1,
          );
          try {
            // some bindings expect (n, Float32Array)
            index.add(docs.length, floatArr);
            console.log("FAISS: index.add(n, floatArr) succeeded");
          } catch (addErr2) {
            console.warn(
              "FAISS: index.add(n, floatArr) failed:",
              addErr2 && addErr2.message ? addErr2.message : addErr2,
            );
            try {
              // last resort: try passing plain Array
              index.add(flat);
              console.log("FAISS: index.add(flat) succeeded");
            } catch (addErr3) {
              console.error("FAISS: all index.add attempts failed.");
              console.error(addErr3 && addErr3.stack ? addErr3.stack : addErr3);
              throw addErr3;
            }
          }
        }

        // Try multiple ways to persist index depending on binding
        try {
          let wrote = false;

          // attempt index.write
          try {
            if (typeof index.write === "function") {
              index.write(OUT_FAISS);
              console.log("FAISS: index.write succeeded ->", OUT_FAISS);
              wrote = true;
            }
          } catch (w1) {
            console.warn(
              "FAISS: index.write attempt failed:",
              w1 && w1.message ? w1.message : w1,
            );
          }

          // attempt faiss.write_index
          try {
            if (faiss && typeof faiss.write_index === "function") {
              faiss.write_index(index, OUT_FAISS);
              console.log("FAISS: faiss.write_index succeeded ->", OUT_FAISS);
              wrote = true;
            }
          } catch (w2) {
            console.warn(
              "FAISS: faiss.write_index attempt failed:",
              w2 && w2.message ? w2.message : w2,
            );
          }

          // attempt faiss.write
          try {
            if (faiss && typeof faiss.write === "function") {
              faiss.write(index, OUT_FAISS);
              console.log("FAISS: faiss.write succeeded ->", OUT_FAISS);
              wrote = true;
            }
          } catch (w3) {
            console.warn(
              "FAISS: faiss.write attempt failed:",
              w3 && w3.message ? w3.message : w3,
            );
          }

          // attempt static Index.write if exposed
          try {
            if (
              faiss &&
              faiss.Index &&
              typeof faiss.Index.write === "function"
            ) {
              faiss.Index.write(index, OUT_FAISS);
              console.log("FAISS: faiss.Index.write succeeded ->", OUT_FAISS);
              wrote = true;
            }
          } catch (w4) {
            console.warn(
              "FAISS: faiss.Index.write attempt failed:",
              w4 && w4.message ? w4.message : w4,
            );
          }

          // finally check file existence
          try {
            const fs = require("fs");
            if (fs.existsSync(OUT_FAISS)) {
              console.log("FAISS: index file exists at", OUT_FAISS);
              wrote = true;
            } else {
              console.warn(
                "FAISS: index file not found after write attempts:",
                OUT_FAISS,
              );
            }
          } catch (w5) {
            console.warn(
              "FAISS: error checking index file existence:",
              w5 && w5.message ? w5.message : w5,
            );
          }

          if (!wrote) {
            console.warn(
              "FAISS: no write method succeeded; index may exist only in-memory.",
            );
          }
        } catch (writeErr) {
          console.error(
            "FAISS: failed to write index file (final):",
            writeErr && writeErr.stack ? writeErr.stack : writeErr,
          );
          throw writeErr;
        }
      } catch (faissErr) {
        console.error("Faiss index creation failed, full stack:");
        console.error(faissErr && faissErr.stack ? faissErr.stack : faissErr);
      }
    } else if (faiss) {
      console.log(
        "FAISS available but not enabled. Set ENABLE_FAISS=true to create FAISS index.",
      );
    }

    const meta = {
      model:
        process.env.COHERE_EMBED_MODEL || embeddingService.getEmbeddingModel(),
      dims,
      count: docs.length,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(OUT_PATH, JSON.stringify({ meta, docs }, null, 2));
    console.log(
      `Index gerado com ${docs.length} chunks. (chunkWords=${CHUNK_WORDS}, overlap=${CHUNK_OVERLAP})`,
    );
  } catch (err) {
    console.error("Erro ao gerar index:", err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();
