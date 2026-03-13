require("dotenv").config();
const { embeddingService } = require("../services/embeddingService");

(async () => {
  try {
    const status = await embeddingService.checkEmbeddingService(8000);
    console.log("Embedding health:", JSON.stringify(status, null, 2));
    process.exit(status && status.ok ? 0 : 2);
  } catch (err) {
    console.error(
      "checkEmbedding failed:",
      err && err.message ? err.message : err,
    );
    process.exit(1);
  }
})();
