const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const DOCS_DIR = path.join(__dirname, "..", "..", "docs");

function listPdfs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(dir, f));
}

async function pdfToMarkdown(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(buffer);
  const title = path.basename(filePath, path.extname(filePath));
  const text = String(parsed.text || "").trim();

  const md = [
    `# ${title}`,
    "",
    text.length > 0 ? text : "_Sem texto extraivel do PDF._",
    "",
  ].join("\n");

  const outPath = path.join(path.dirname(filePath), `${title}.md`);
  fs.writeFileSync(outPath, md, "utf8");
  return outPath;
}

async function main() {
  const pdfs = listPdfs(DOCS_DIR);
  if (pdfs.length === 0) {
    console.log("Nenhum PDF encontrado.");
    return;
  }

  for (const pdf of pdfs) {
    const out = await pdfToMarkdown(pdf);
    console.log(`Gerado: ${out}`);
  }
}

main().catch((err) => {
  console.error("Erro ao gerar markdown:", err);
  process.exit(1);
});
