const { chunkTextWithOverlap } = require("../utils/chunking");

function run() {
  const sample = Array.from({ length: 1200 })
    .map((_, i) => `word${i + 1}`)
    .join(" ");
  const chunks = chunkTextWithOverlap(sample, 250, 0.25);

  if (!Array.isArray(chunks) || chunks.length === 0) {
    console.error("Falha: nenhum chunk gerado");
    process.exit(2);
  }

  const okSize = chunks.every((c) => {
    const len = c.text.split(/\s+/).filter(Boolean).length;
    return len > 0 && len <= 300;
  });

  if (!okSize) {
    console.error("Falha: algum chunk tem tamanho inesperado");
    console.error(chunks.slice(0, 3));
    process.exit(3);
  }

  console.log("Teste chunking OK —", chunks.length, "chunks gerados");
  process.exit(0);
}

run();
