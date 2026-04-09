# IT English Practice Coach — local setup

This guide explains how to run the monorepo on your machine (outside Replit). After dependencies and a database are in place, you mainly need to **set your OpenAI API key** and the rest of the variables in `.env`.

## Requirements

- **Node.js** (24.x recommended; see `replit.md`)
- **pnpm** (required; the repo blocks npm/yarn via `preinstall`)
- **Docker** (optional; only if you want PostgreSQL in a container)

## 1. Install dependencies

From the repo root:

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
| `VITE_PORT` (Vite) | Vite dev server port — e.g. `5173`. |
| `BASE_PATH` | Usually `/` for local development. |
| `API_PROXY_TARGET` | API base URL for Vite to proxy `/api` during dev — e.g. `http://127.0.0.1:3000` (must match the API `PORT`). |

Place `.env` at the **root** of the repository. Vite is configured with `envDir` so it loads this file.

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

- `db:push`: applies the Drizzle schema to the database. All tables include lifecycle columns (`id`, `createdAt`, `updatedAt`, `deletedAt`) managed automatically.
- `db:seed`: truncates and re-inserts the eight built-in practice scenarios with auto-generated **16-character NanoIDs**.

> **Note on soft deletes:** Records deleted via the UI are marked with a `deletedAt` timestamp and filtered out from all queries automatically. They are not physically removed.

## 5. Run the app (two terminals)

**Terminal 1 — API:**

```bash
pnpm dev:api
```

**Terminal 2 — web UI:**

```bash
pnpm dev:web
```

Open the app at `http://localhost:<VITE_PORT>` (set `VITE_PORT=5173` in `.env` as in `.env.example`).

`API_PROXY_TARGET` lets the browser call `/api/...` on the same origin as Vite during development (no manual cross-port CORS setup for those requests).

## 6. Quick checks

- API: look for a "Server listening" log and try `GET /api/healthz`.
- Voice/chat errors: verify the key, quota, and models; the app uses OpenAI via the `AI_INTEGRATIONS_*` variables.

## Useful commands (root `package.json`)

| Command | Description |
|---------|-------------|
| `pnpm run typecheck` | Typecheck the whole monorepo |
| `pnpm db:push` | Push Drizzle schema to database |
| `pnpm db:seed` | Truncate & re-seed practice scenarios |
| `pnpm dev:api` | Run the API server in dev mode |
| `pnpm dev:web` | Run the Vite frontend in dev mode |

For package layout and stack details, see `replit.md`.

## Architecture overview

| Layer | Package | Description |
|-------|---------|-------------|
| Database | `@workspace/db` | Drizzle ORM + PostgreSQL. Exports a `BaseRepository` abstraction with soft-delete, `findAll`, `findOneById`, `create`, `update` and `softDelete` methods. All entity IDs use 16-character alphanumeric NanoIDs. |
| API validation | `@workspace/api-zod` | Auto-generated Zod schemas from the OpenAPI spec in `lib/api-spec`. Re-run codegen with `pnpm --filter @workspace/api-spec run codegen`. |
| API client | `@workspace/api-client-react` | Auto-generated React Query hooks for the frontend. |
| API server | `@workspace/api-server` | Express routes for `/practice/*` and `/openai/*`. |
| Frontend | `@workspace/english-practice` | Vite + React SPA. State managed with Zustand. |

## CI / CD (GitHub Actions)

Workflows live under `.github/workflows/`.

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
