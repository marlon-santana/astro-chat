require("dotenv").config();
const { vectorRepository } = require("../repositories/vectorRepository");
const { ragService } = require("../services/ragService");

async function measure() {
  const queries = [
    "Como criar turma?",
    "Como vincular aluno a turma?",
    "Qual o formato de importacao de planilha?",
  ];
  const iterations = 3;

  console.log(
    "Measuring latency (search + full answer) for",
    iterations,
    "iterations per query",
  );

  for (const q of queries) {
    console.log("\nQuery:", q);
    let totalSearch = 0;
    let totalFull = 0;
    for (let i = 0; i < iterations; i++) {
      const t0 = Date.now();
      await vectorRepository.search(q, 3);
      const t1 = Date.now();
      const searchMs = t1 - t0;
      totalSearch += searchMs;

      const t2 = Date.now();
      try {
        await ragService.answerQuestion(q, []);
      } catch (e) {
        // ragService may throw when LLM unavailable; still measure elapsed
      }
      const t3 = Date.now();
      const fullMs = t3 - t2;
      totalFull += fullMs;

      console.log(`  iter ${i + 1}: search=${searchMs}ms full=${fullMs}ms`);
      // small delay
      await new Promise((r) => setTimeout(r, 250));
    }
    console.log(
      `  avg search=${Math.round(totalSearch / iterations)}ms avg full=${Math.round(totalFull / iterations)}ms`,
    );
  }
}

measure()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(2);
  });
