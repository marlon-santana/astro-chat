const { vectorRepository } = require("../repositories/vectorRepository");

(async () => {
  const q = process.argv.slice(2).join(" ") || "Como criar turma?";
  console.log("Running vector search smoke test. Query:", q);
  try {
    const res = await vectorRepository.search(q, 5);
    console.log("Results:", JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(
      "Search test failed:",
      err && err.message ? err.message : err,
    );
    process.exit(2);
  }
})();
