const { embeddingService } = require('../services/embeddingService');

async function run() {
  const key = process.env.COHERE_API_KEY;
  if (!key) {
    console.log('COHERE_API_KEY not set — test will skip. Set COHERE_API_KEY in .env to run live test.');
    process.exit(0);
  }

  try {
    console.log('Requesting test embedding from Cohere...');
    const v = await embeddingService.embedText('teste de embedding');
    if (!Array.isArray(v) || v.length === 0) {
      console.error('No vector returned');
      process.exit(2);
    }
    console.log('Embedding length:', v.length);
    console.log('Sample values:', v.slice(0, 5));
    process.exit(0);
  } catch (err) {
    console.error('Cohere test failed:', err && err.message ? err.message : err);
    process.exit(3);
  }
}

run();
