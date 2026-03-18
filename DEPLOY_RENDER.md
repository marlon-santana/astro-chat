Render deployment notes for astro-chat

Prerequisites

- Push this repository to a Git provider connected to Render (GitHub/GitLab/Bitbucket).
- On Render dashboard, create two services: `astro-chat-web` (web, Docker) and `astro-chat-qdrant` (service, Docker). Alternatively use the provided `render.yaml` which defines both services.

Required environment variables (web service)

- `COHERE_API_KEY` : your Cohere API key (set as secret in Render).
- `USE_QDRANT`: "true"
- `QDRANT_URL`: http://astro-chat-qdrant:6333 (already set in render.yaml)
- `SQLITE_DB_PATH`: /app/data/metadata.sqlite

Disks

- Web service: mount a disk at `/app/data` (1 GB is sufficient for metadata.sqlite in small deployments).
- Qdrant: mount a disk at `/qdrant/storage` (size depends on vectors; e.g., 10 GB).

Healthcheck and Dockerfile

- Dockerfile includes a `HEALTHCHECK` that requests `/health`. Render uses Docker health status to determine service health — ensure `HEALTHCHECK` succeeds within the configured timeouts.
- We added runtime tools (`wget`, `curl`) and tuned `HEALTHCHECK` (`--start-period`, `--retries`) to reduce false negatives.

Deploy steps (recommended)

1. Ensure `render.yaml` is present at repo root and contains the `QDRANT_URL` env var (it does).
2. Commit & push your changes to the repo.
3. On Render, create a new Web Service and point it to the repo (or import via `render.yaml`).
4. Set `COHERE_API_KEY` as a secret env for the web service.
5. Trigger deploy (Render will build Docker images using `Dockerfile`).

Local validation (before deploy)

- Build and run locally:

```bash
# Build and run Qdrant + app locally
docker compose up -d --build
# Check services
curl http://localhost:3001/health
curl http://localhost:6333/collections
```

Post-deploy checks

- Verify `astro-chat-web` service deploy logs for `npm ci` and `node src/server.js` startup.
- Check `astro-chat-qdrant` logs for collection creation and searches.
- Run a quick POST to `/chat` to confirm behavior:

```bash
curl -X POST https://<your-render-url>/chat -H "Content-Type: application/json" -d '{"question":"Teste: vínculo de turma"}'
```

Notes

- The repository currently upserts vectors from `data/index.json` into Qdrant via `src/scripts/qdrant_upsert_from_index.js`. Run this locally before pushing if you want the collection populated prior to deploy demo.
- For production, consider moving metadata from SQLite to a managed DB and backing up Qdrant storage.

If you want, I can also add a short `README` section and create a PR with these changes.
