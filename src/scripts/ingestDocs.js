const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const pdfParse = require('pdf-parse');
const { createCanvas } = require('canvas');
const { createWorker } = require('tesseract.js');
const { chunkText } = require('../utils/chunking');

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');
const OUT_PATH = path.join(__dirname, '..', '..', 'data', 'index.json');

const OCR_ENABLED = (process.env.OCR_PDF || 'true').toLowerCase() === 'true';
const OCR_ENGINE = (process.env.OCR_ENGINE || 'pdfjs').toLowerCase();
const OCR_LANG = process.env.OCR_LANG || 'por';
const OCR_SCALE = Number(process.env.OCR_SCALE || 2.0);

function listDocs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.pdf'))
    .map(f => path.join(dir, f));
}

async function readDoc(filePath) {
  const title = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(buffer);
    let content = parsed.text || '';

    if (OCR_ENABLED) {
      const ocrText = await tryOcr(buffer, filePath);
      if (ocrText.trim().length > 0) {
        content = `${content}\n\n[OCR]\n${ocrText}`.trim();
      }
    }

    return { title, content };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return { title, content: raw };
}

async function tryOcr(buffer, filePath) {
  try {
    if (OCR_ENGINE === 'external') {
      return ocrPdfExternal(filePath);
    }
    return await ocrPdfPdfjs(buffer);
  } catch (err) {
    console.warn('OCR falhou, continuando sem OCR:', err.message || err);
    return '';
  }
}

async function ocrPdfPdfjs(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const standardFontsPath = path.join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts');
  if (fs.existsSync(standardFontsPath)) {
    pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = pathToFileURL(standardFontsPath + path.sep).href;
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const worker = await createWorker(OCR_LANG);

  const CanvasFactory = {
    create(width, height) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
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
    }
  };

  let out = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const target = CanvasFactory.create(viewport.width, viewport.height);

      await page.render({ canvasContext: target.context, viewport, canvasFactory: CanvasFactory }).promise;
      const img = target.canvas.toBuffer('image/png');

      const { data } = await worker.recognize(img);
      const text = data && data.text ? String(data.text).trim() : '';
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihelp-ocr-'));
  const prefix = path.join(tmpDir, 'page');

  // Requires poppler (pdftoppm) and tesseract installed in PATH
  execFileSync('pdftoppm', ['-png', filePath, prefix], { stdio: 'ignore' });

  const images = fs.readdirSync(tmpDir)
    .filter(f => f.startsWith('page-') && f.endsWith('.png'))
    .map(f => path.join(tmpDir, f))
    .sort();

  let out = '';
  images.forEach((imgPath, idx) => {
    const text = execFileSync('tesseract', [imgPath, 'stdout', '-l', OCR_LANG], { encoding: 'utf8' });
    const cleaned = String(text || '').trim();
    if (cleaned.length > 0) {
      out += `\n\n[OCR Pagina ${idx + 1}]\n${cleaned}`;
    }
  });

  // cleanup
  images.forEach(p => fs.unlinkSync(p));
  fs.rmdirSync(tmpDir);

  return out.trim();
}

async function buildIndex() {
  const files = listDocs(DOCS_DIR);
  const index = [];

  for (const file of files) {
    const { title, content } = await readDoc(file);
    const chunks = chunkText(content, 500);

    chunks.forEach((chunk, i) => {
      index.push({
        id: `${title}#${i + 1}`,
        source: title,
        content: chunk
      });
    });
  }

  return index;
}

async function main() {
  try {
    const index = await buildIndex();
    fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 2));
    console.log(`Index gerado com ${index.length} chunks.`);
  } catch (err) {
    console.error('Erro ao gerar index:', err);
    process.exit(1);
  }
}

main();