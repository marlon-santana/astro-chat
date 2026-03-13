function chunkText(text, maxTokens = 500) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  const chunks = [];
  let current = [];

  for (const w of words) {
    current.push(w);
    if (current.length >= maxTokens) {
      chunks.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

function chunkTextWithOverlap(text, chunkWords = 250, overlap = 0.2) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];

  const ratio = Math.max(0, Math.min(1, overlap));
  const step = Math.max(1, Math.round(chunkWords * (1 - ratio)));
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    const end = Math.min(words.length, start + chunkWords);
    const chunkWordsArr = words.slice(start, end);
    chunks.push({
      index: index + 1,
      startWord: start,
      endWord: end - 1,
      text: chunkWordsArr.join(" "),
    });
    index += 1;
    start += step;
  }

  return chunks;
}

module.exports = { chunkText, chunkTextWithOverlap };
