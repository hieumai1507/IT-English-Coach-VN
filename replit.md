# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 text + gpt-audio voice)

## Project: IT English Practice Coach

A voice-based English practice app for Vietnamese IT professionals. Features real-time voice conversation with an AI coach across 8 IT workplace scenarios.

### Features
- 8 IT practice scenarios: Standup, Code Review, Technical Interview, Client Presentation, Bug Debugging, Sprint Planning, Salary Negotiation, Remote Team Communication
- Voice chat using OpenAI gpt-audio (speech-to-speech)
- AI feedback with scores after each session
- Practice history and statistics
- Dashboard with progress tracking

### Pages
- `/` — Dashboard with stats and recent sessions
- `/scenarios` — Browse and start practice scenarios
- `/practice/:conversationId` — Live voice practice session
- `/history` — Past sessions list
- `/session/:id` — Detailed session view with transcript and feedback

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Tables
- `conversations` — OpenAI conversation threads
- `messages` — Individual messages in conversations
- `scenarios` — IT practice scenarios (seeded with 8 scenarios)
- `practice_sessions` — User practice session records

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
