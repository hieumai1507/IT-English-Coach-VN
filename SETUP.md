# IT English Practice Coach — local setup

This guide explains how to run the monorepo on your machine (outside Replit). After dependencies and a database are in place, you mainly need to **set your OpenAI API key** and the rest of the variables in `.env`.

## Requirements

- **Node.js** (24.x recommended; see `replit.md`)
- **pnpm** (required; the repo blocks npm/yarn via `preinstall`)
- **Docker** (optional; only if you want PostgreSQL in a container)

## 1. Install dependencies

From the `English-Practice-Bot` directory:

```bash
pnpm install
```

## 2. Environment variables

```bash
cp .env.example .env
```

Adjust the following for your environment:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string. The default in `.env.example` points at Docker on port **5433** (avoids clashing with a system Postgres on 5432). |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | **Required** — API key from [OpenAI](https://platform.openai.com/). |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | For the official API: `https://api.openai.com/v1`. |
| `PORT` | API server port (default `3000`). |
| `PORT` (Vite) | In the same `.env`, the Vite dev server port — e.g. `5173`. |
| `BASE_PATH` | Usually `/` for local development. |
| `API_PROXY_TARGET` | API base URL for Vite to proxy `/api` during dev — e.g. `http://127.0.0.1:3000` (must match the API `PORT`). |

Place `.env` at the **root** of `English-Practice-Bot/`. Vite is configured with `envDir` so it loads this file.

## 3. PostgreSQL

### Option A: Docker (recommended if Docker is available)

```bash
docker compose up -d
```

If port 5432 is already in use, `docker-compose.yml` maps host **5433** → container `5432`; keep `DATABASE_URL` consistent (port **5433** on the host).

### Option B: Existing Postgres installation

Create a database and user, then set `DATABASE_URL` accordingly.

## 4. Schema and seed data

From the repo root (with `.env` present):

```bash
pnpm db:push
pnpm db:seed
```

- `db:push`: applies the Drizzle schema to the database.
- `db:seed`: inserts the eight practice scenarios (runs only when the `scenarios` table is empty).

## 5. Run the app (two terminals)

**Terminal 1 — API:**

```bash
set -a && source .env && set +a && pnpm dev:api
```

**Terminal 2 — web UI:**

```bash
set -a && source .env && set +a && pnpm dev:web
```

Open the app at `http://localhost:<Vite_PORT>` (uncomment or set `PORT=5173` in `.env` as in `.env.example`).

`API_PROXY_TARGET` lets the browser call `/api/...` on the same origin as Vite during development (no manual cross-port CORS setup for those requests).

## 6. Quick checks

- API: look for a “Server listening” log and try `GET /api/healthz` (or the health route defined in the project’s OpenAPI spec).
- Voice/chat errors: verify the key, quota, and models; the app uses OpenAI via the `AI_INTEGRATIONS_*` variables.

## Useful commands (root `package.json`)

| Command | Description |
|---------|-------------|
| `pnpm run typecheck` | Typecheck the whole workspace |
| `pnpm db:push` | Push Drizzle schema |
| `pnpm db:seed` | Seed scenarios |
| `pnpm dev:api` | Run the API server in dev |
| `pnpm dev:web` | Run the Vite frontend in dev |

For package layout and stack details, see `replit.md`.

## CI / CD (GitHub Actions)

Workflows live under `.github/workflows/` (this folder is inside `English-Practice-Bot/` — use that directory as the **git repository root** when you push to GitHub).

### CI (`ci.yml`)

Runs on every push and pull request to `main` or `master`:

1. `pnpm install --frozen-lockfile`
2. `pnpm run typecheck`
3. `pnpm run build`

Build-time env for Vite is set in the workflow (`PORT`, `BASE_PATH`, `NODE_ENV`). No secrets are required.

### Release / CD (`release.yml`)

Runs when you push a **version tag** matching `v*` (e.g. `v1.0.0`):

1. Same install + full `pnpm run build`
2. Creates tarballs: `web-dist.tar.gz` (static frontend) and `api-dist.tar.gz` (bundled API)
3. Attaches them to a **GitHub Release** for that tag (uses `GITHUB_TOKEN` automatically)

Example:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Deploy those artifacts on your host (VM, container platform, etc.) and configure runtime env (`DATABASE_URL`, OpenAI keys, `PORT`) on the server.

### Monorepo note

If your git root is **above** `English-Practice-Bot/` (e.g. a parent folder holds multiple projects), move `.github` to that repository root and add `defaults.run.working-directory: English-Practice-Bot` to each job, or run CI only from a dedicated repo whose root is `English-Practice-Bot/`.
