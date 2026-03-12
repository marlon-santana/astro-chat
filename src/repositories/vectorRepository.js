const fs = require('fs');
const path = require('path');
const { embeddingService } = require('../services/embeddingService');

const INDEX_PATH = path.join(__dirname, '..', '..', 'data', 'index.json');

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(INDEX_PATH, 'utf8');
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function search(question, topK = 3) {
  const index = loadIndex();
  if (index.length === 0) return [];

  const qTokens = new Set(embeddingService.embedText(question));

  const scored = index.map(doc => {
    const dTokens = new Set(embeddingService.embedText(doc.content));
    let score = 0;
    for (const t of qTokens) {
      if (dTokens.has(t)) score++;
    }
    return { ...doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = { vectorRepository: { search } };