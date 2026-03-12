function chunkText(text, maxTokens = 500) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = [];

  for (const w of words) {
    current.push(w);
    if (current.length >= maxTokens) {
      chunks.push(current.join(' '));
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(' '));
  }

  return chunks;
}

module.exports = { chunkText };