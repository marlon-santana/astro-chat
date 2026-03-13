const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { chatController } = require("./controllers/chatController");
const { embeddingService } = require("./services/embeddingService");

const app = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(morgan("dev"));

app.post("/chat", chatController);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/embedding-health", async (req, res) => {
  try {
    const st = await embeddingService.checkEmbeddingService(8000);
    res.json(st);
  } catch (err) {
    res
      .status(500)
      .json({
        ok: false,
        error: err && err.message ? err.message : String(err),
      });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ai-help-service listening on port ${PORT}`);
  // run a quick check at startup (logs only)
  (async () => {
    try {
      const st = await embeddingService.checkEmbeddingService(8000);
      console.log("Embedding health at startup:", st);
    } catch (err) {
      console.warn(
        "Embedding health check failed at startup:",
        err && err.message ? err.message : err,
      );
    }
  })();
});
