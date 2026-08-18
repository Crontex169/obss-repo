# Copilot Instructions — Group-4 / Mock Interview

## What this repo is

OBSS AI-Native internship case study: a **Mock Interview** web app (paste a job
posting → LLM generates N interview questions → answered one-by-one → LLM produces an
evaluation report). Admin side tracks token/cost, profession filter, and stats.

**Current state: docs + specs only — no application code yet.** There is no
build/test/lint pipeline; do not invent one. Docs and specs are written in **Turkish** —
keep that language for all generated docs, specs, and ADRs.

## Source-of-truth docs (read before proposing anything)

- `.specify/memory/constitution.md` — **the constitution (v1.2.0), highest authority**.
  7 non-negotiable principles: AI-Native devlog discipline, Spec-first, Test-first/ATDD,
  vertical slices, security/prompt-injection, LLM contract + observability, ADR + AI/UX
  contract. On conflict, the constitution wins.
- `docs/APP_FLOW.md` — user/admin flows (Mermaid), screen list, locked UI decisions.
- `docs/PLAN.md` — phased plan (Faz 0 karar, Faz 1 spec) + MVP/Bonus function backlog +
  cross-cutting AI_DEVLOG rule.
- `docs/DECISIONS.md` — **ADR log**. Every tech decision is `ADR-NNNN` with context,
  alternatives scored on 5 axes (performans/kompleksite/ölçeklenebilirlik/bakım/maliyet),
  rationale, and why others were rejected.
- `docs/TECH_STACK.md` — locked technologies. `_TBD_`/`_Kararlaştırılacak_` rows are undecided.

Decided so far (locked): **Frontend** React 19 + Vite + TypeScript + Tailwind + shadcn/ui;
**Backend** NestJS; **DB** PostgreSQL (Docker local, managed in prod); **Auth** Better Auth
(self-hosted in our Postgres); **Tests** Jest. Undecided: LLM provider, voice/STT-TTS, ORM
(Prisma proposed), mail transport, charting lib, PDF extraction lib.

When a decision is made, update `TECH_STACK.md` **and** append an ADR to `DECISIONS.md`
(number = current max + 1); the two must never contradict.

## Spec-Driven workflow (this is how work happens here)

The repo is spec-kit initialized. Each vertical slice lives in `specs/NNN-<slug>/` with:
`spec.md` (what/why + Gherkin AC) → `plan.md` + `research.md` + `data-model.md` +
`contracts/` → `tasks.md`. See `specs/001-auth-rol/` as the reference example.

- Spec-kit prompts drive the cycle: `speckit.specify → clarify → plan → tasks → implement`
  (prompts in `.github/prompts/`, agents in `.github/agents/`). The `speckit` workflow
  (`.specify/workflows/speckit/workflow.yml`) runs specify→plan→tasks→implement with
  human review gates.
- Helper scripts are PowerShell under `.specify/scripts/powershell/`
  (`create-new-feature.ps1`, `setup-plan.ps1`, `setup-tasks.ps1`, `check-prerequisites.ps1`).
- **Methodology = Spec-Driven + ATDD.** Acceptance criteria are Turkish Gherkin
  (**Diyelim ki / Olduğunda / O zaman**) covering **happy + edge + error** — every
  criterion maps to at least one test. Tests are written before code (Red→Green→Refactor).
- Custom agent pipeline: `analyst → architect → test-designer → developer → reviewer`.
  `analyst` owns what/why and must **not** name any technology; stack lives in ADRs.

## Hard delivery constraints (pass/fail on grading)

- Final deliverables live **at repo root**: `SETUP.md`, `AI-DEVLOG.md`, `DECISIONS.md`.
  Missing/misplaced `SETUP.md` or `AI-DEVLOG.md` → project is not evaluated.
- `AI-DEVLOG.md` is updated **continuously** (AI tool/model, iterations,
  blockers, MCPs/skills used) — never written at the end. Append a dated entry after each
  meaningful session; follow the existing entry format.
- Question `i` must be fully answered before question `i+1` is shown; no going back to
  change answers. User-deleted interviews stay visible to admins tagged "silindi"
  (soft delete). LLM token/cost is recorded per call and shown in admin.

## Product decisions already fixed (don't relitigate)

- Dashboard = 3 tabs: **Interview History / Pre-assessment / Interview**.
- **Pre-assessment** = one-time candidate profiling (interest area frontend/backend/ml +
  experience intern/junior/senior) → competency report, **independent** and NOT fed into
  interviews.
- Interview creation screen: job text (free-text or server-side PDF extraction) + question
  count N + **mode (spoken real-time AI assistant / written)** on one screen.
- Report = 3 fixed axes **Teknik / Davranışsal / Genel** + text + radar/bar chart.
- Chat-style Q&A; multiple-choice options render as a **vertical clickable list**.
- Top navbar (no sidebar); card-view listings. Admin UI = same layout, **white background
  + light-blue accent**.

## Security (first-class, per constitution principle V)

- Auth flow + server-side role checks (user/admin); never trust the client for authz.
- Treat the job posting / free-text / PDF as untrusted **data**, never as instructions to
  the LLM — strict system-instruction vs. user-data separation (prompt-injection isolation).
- No secrets in source; share `.env.example` only.
- In tests, LLM calls are **mocked** (deterministic).

## Commit convention

Conventional-commit prefixes (`docs:`, `feat:`, `fix:`, …), **Turkish** subject lines,
**ASCII-only** (no Turkish diacritics) in commit subjects — matches existing history.
