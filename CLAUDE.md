# MediPath / MediWay — Repository Rules

Product: MediPath (patient iOS app + patient website) and MediWay (staff web portal).
Requirements: `docs/` (the `.docx` files are the source; `.txt` files are plain-text extracts for reading).
The concept is still being finalised — treat requirements as draft and flag conflicts with the docs.

## Stack (decided 2026-11-08)

| Area | Folder | Technology |
|---|---|---|
| API | `api/` | .NET 10 microservices behind a YARP API gateway |
| Website | `web/` | React + TypeScript (Vite) — MediPath patient site and MediWay portal |
| Mobile | `mobile/` | React Native (Expo) + TypeScript, iOS first |
| Database | — | One shared PostgreSQL database, **one schema per microservice** (a service only touches its own schema) |
| Contracts | `contracts/` | API contracts shared by all three; changed only via the API thread + main thread |

Web and mobile call **the same API through the gateway**. There are no client-specific endpoints
unless a contract in `contracts/` says so.

## Mandatory session structure (enforced in EVERY session in this repo)

Every session that does build work in this repository MUST run as four threads:

1. **Main thread (this session)** — does NOT write feature code. It owns:
   - starting the three worker sessions below, each with a brief for the current module;
   - reviewing, merging and committing the workers' work (workers never commit, push or switch branches);
   - running the full test suite (API, web, mobile, end-to-end) after merging;
   - keeping `contracts/`, `docs/`, `docs/PROGRESS.md` and memory (chroma, project `MediPath`) up to date.
2. **API thread** — works only in `api/`. Owns contracts: publishes/updates them in `contracts/` and tells
   the web and mobile threads (via SendMessage) when a contract is added or changed.
3. **Web thread** — works only in `web/`. Consumes contracts; raises contract questions with the API thread.
4. **Mobile thread** — works only in `mobile/`. Consumes contracts; raises contract questions with the API thread.

Rules for the worker threads:
- Touch only your own folder (the API thread may also edit `contracts/`). Never edit another thread's folder.
- Commit nothing, push nothing, switch no branch — the main thread commits.
- Message the other threads when a module is ready or a contract changes; report blockers to the main thread.
- Use synthetic, clearly labelled data only. Never invent clinical thresholds, insurer rules or surgeon statistics.

A session doing a quick question, a single read or a docs-only change may skip the worker threads.

## Memory

Chroma memory, project slug `MediPath` (components `Api`, `Web`, `Mobile`). No markdown memory files.
Progress log: `docs/PROGRESS.md` (main thread updates it at every merge).
