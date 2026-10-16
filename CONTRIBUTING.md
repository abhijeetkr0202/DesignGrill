# Contributing to DesignGrill

Thanks for helping. DesignGrill is a local-first desktop app (Tauri 2, React, TypeScript, Rust, SQLite).

## Setup

Prerequisites:

- Node.js 20.19+ or 22.12+ and npm.
- Rust stable (install with `rustup`) and the Tauri prerequisites for your OS: <https://tauri.app/start/prerequisites/>
  - macOS: Xcode Command Line Tools.
  - Windows: Microsoft C++ Build Tools and WebView2 (preinstalled on current Windows 10/11).

```bash
npm install
npm run dev           # UI only, in a browser (in-memory data, no AI, no key storage)
npm run dev:desktop   # full desktop app
npm run check         # format check, lint, typecheck, frontend tests
npm run test:rust     # Rust unit tests
npm run build         # typecheck and production frontend build
npm run build:desktop # desktop bundle for the current OS
```

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: business logic lives in `src/features`, pure session commands in `src/features/interview-session/commands.ts`, provider-specific code only in `src/ai/providers`, persistence in `src-tauri/src/db.rs` behind `src/data/repositories`, and interview content in `content/problems`.

## Guidelines

- Keep business logic out of React components; add a test for new commands and services.
- Treat model output as untrusted: validate with a Zod schema before using it.
- Never log or persist API keys. Never add a command that returns a stored key.
- Keep Tauri capabilities minimal. New native commands must be added to both `src-tauri/build.rs` and `src-tauri/capabilities/default.json`.
- Database changes need a new numbered file in `src-tauri/migrations` and a registry entry in `db.rs`; never edit a shipped migration.
- Run `npm run check` and `npm run test:rust` before opening a pull request.

## Adding an interview problem

Create `content/problems/<id>/` with `problem.json`, `knowledge.md`, `reference-architectures.json`, and `scenarios.json`. No application code changes are needed; packs are validated at load time (`src/features/problem-library/schema.ts`) and invalid packs are reported in the library. Requirements:

- Write original content. Do not copy articles, paid interview material, or third-party solution repositories unless their license allows it and you attribute them.
- Label workload numbers as illustrative.
- Present several valid alternatives; the pack must not imply a single mandatory solution.

## Changing prompts

Prompts live in `src/ai/prompts/*.md`. Conversational prompts must not ask for scores; scoring happens only in the session summary using `scoring-rubric.md`. Add or update tests in `tests/interviewer.test.ts`.

## Licensing

By contributing you agree that your contribution is licensed under the MIT License.
