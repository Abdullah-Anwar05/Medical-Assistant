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
| Shared client code | `packages/client-core/` | TypeScript package used by web AND mobile: contract types, roles, API client core, ApiError, validators, design tokens. **Owned by the Web thread**; mobile requests changes from it |
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
3. **Web thread** — works only in `web/` and `packages/client-core/`. Consumes contracts; raises contract questions with the API thread. Tells the mobile thread when `client-core` changes.
4. **Mobile thread** — works only in `mobile/`. Consumes contracts and `client-core`; requests `client-core` changes from the web thread and contract changes from the API thread.

Rules for the worker threads:
- Touch only your own folder (the API thread may also edit `contracts/`; the web thread also owns `packages/client-core/`). Never edit another thread's folder.
- Commit nothing, push nothing, switch no branch — the main thread commits.
- Message the other threads when a module is ready or a contract changes; report blockers to the main thread.
- Use synthetic, clearly labelled data only. Never invent clinical thresholds, insurer rules or surgeon statistics.

A session doing a quick question, a single read or a docs-only change may skip the worker threads.

## Coding standards (mandatory, enforced at all costs — decided 2026-11-09)

All code in `api/`, `web/` and `mobile/` must follow:

1. **SOLID principles** — single responsibility per class/module/component; extend via abstractions rather than editing working code; substitutable implementations; small focused interfaces; depend on abstractions (constructor injection in .NET, injected services/hooks in React).
2. **Clean Architecture** — dependencies point inward only.
   - API: each microservice is split into `Domain` (entities, value objects, domain rules; no framework references) → `Application` (use cases, interfaces/ports, DTOs, validation) → `Infrastructure` (EF Core, PostgreSQL, external adapters) → `Api` (endpoints, DI composition only). Endpoints contain no business logic; the domain never references EF Core or ASP.NET.
   - Web and mobile: UI components → hooks/view models → services/use cases → API client and adapters. Components render only; no fetch calls or business rules inside components.
3. **Best coding practices** — meaningful names, small functions, explicit error handling (no swallowed exceptions or blanket catch-return-empty), validated input at boundaries, no secrets in code, no dead or commented-out code, typed everything (no `any`, nullable reference types on), tests ship with every behaviour change.
4. **No code duplication** — shared logic lives in one place: `api/src/BuildingBlocks` for cross-service .NET code, a shared module per client for web/mobile. Copy-pasted logic, repeated DTO/type definitions or duplicated validation is a defect. Before writing a helper, search for an existing one.

### Code audit before every commit

The main thread runs a code audit on the full staged diff **before every commit**, and does not commit until it passes:
- Review against the four standards above plus `C:\Users\AbdullahAnwar\.claude\CODE_REVIEW.md` (correctness, security, error handling).
- Check layering (no inward-pointing violations), duplication (search for repeated logic across files and services), and that tests cover the change.
- Record the audit result (pass, or findings and how they were fixed) in the commit message body.
- Findings go back to the worker thread that owns the folder; the main thread does not fix feature code itself.
Workers self-check against these standards before reporting a module as done.

## Memory

Chroma memory, project slug `MediPath` (components `Api`, `Web`, `Mobile`). No markdown memory files.
Progress log: `docs/PROGRESS.md` (main thread updates it at every merge).
