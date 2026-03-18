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

1- Coloque a documentação em docs (ou onde seu loader lê).
2- Re-gerar o index (chunking + embeddings):

```bash
node src/scripts/ingestDocs.js
```

3- Atualizar/guardar metadados em SQLite:

```bash
node src/scripts/sqlite_upsert_from_index.js
```

4- Upsert dos vetores para Qdrant:

```bash
node src/scripts/qdrant_upsert_from_index.js
```
