# astro-chat

Small AI help chat backend. This repository supports ingesting documents, generating embeddings and running retrieval.

## Cohere Embeddings (optional)

1. Create a Cohere account and get an API key: https://cohere.ai
2. Add the key to `.env` (or use `.env.example` as reference):

```
COHERE_API_KEY=your_cohere_api_key
COHERE_EMBED_MODEL=embed-english-v2.0
```

3. Test the Cohere embedding from the project root:

```bash
node src/scripts/testCohere.js
```

4. Reindex documents (this will call the embedding service):

```bash
npm run reindex
```

Notes:
- The project supports multiple embedding providers; Cohere is preferred when `COHERE_API_KEY` is set.
- There is a deterministic local fallback for development when no embedding endpoint is reachable.
- Tune `EMBED_BATCH_SIZE` in `.env` to respect rate limits.

## anexar um novo documento

# opcional: verifique o provider de embeddings
node src/scripts/checkEmbedding.js

# reindex (sem FAISS)
node src/scripts/ingestDocs.js

# reindex com FAISS (se quiser criar index.faiss)
ENABLE_FAISS=true node src/scripts/ingestDocs.js
