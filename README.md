# DesignGrill

Your architecture. Under pressure.

DesignGrill is an open-source, local-first desktop app for practicing system design interviews. You write requirements, draw an architecture on a canvas, and an AI interviewer challenges your actual design: it reads your requirements, components, connections, and decisions, then asks questions and raises risks grounded in what you built.

It is not a chatbot beside a diagram editor. The interviewer works from a structured, validated snapshot of your session, not a screenshot and not just the problem title.

## Status

Early development (v0.1). Below is what is implemented today versus planned.

### Implemented

- Desktop app (Tauri 2, macOS and Windows targets) with a React and TypeScript UI. A macOS release build has been verified locally; Windows builds are configured in CI but have not been run yet.
- Problem library with 50 problems across gaming, streaming, ticketing, booking, food delivery, commerce, messaging, maps, search, storage, and infrastructure, filterable by category and difficulty. Content is independent of code (`content/problems`).
- Requirements workspace: functional, non-functional (with optional measurable targets), assumptions, constraints, capacity estimates, open questions; confirmed or unresolved status, priority, notes.
- Architecture canvas (React Flow): typed or custom components, directed connections, per-component and per-connection metadata, undo and redo, minimap, fit view.
- Canonical, versioned session model with Zod validation; the canvas is derived from it.
- Design decisions linked to components and requirements; decisions are flagged for re-evaluation when a linked requirement changes.
- Local persistence in SQLite (platform app-data directory) with migrations and pre-migration backups, autosave, resume, and session deletion.
- AI providers: OpenAI and Anthropic through a provider-independent interface. API keys are stored in the OS credential store and read only by the native layer.
- Interviewer modes: requirements discovery, architecture question, architecture review with structured findings, failure-scenario challenge, answer evaluation, and a session summary with a documented rubric.
- Change tracking since the last review, outdated-response markers, bounded retry, cancellation, and validation of all model output.
- Automated tests (Vitest and Rust) and CI for macOS and Windows.

### Planned

- Streaming responses.
- Session export and import.
- Additional problems and providers.
- Signed and notarised release builds.
- Voice interview mode (later).

See [Known limitations](#known-limitations).

## Quick start

Prerequisites: Node.js 20.19+ or 22.12+, Rust stable, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run dev:desktop   # full desktop app
npm run dev           # UI only in a browser: data kept in memory, no AI
npm run check         # format check, lint, typecheck, tests
npm run test:rust     # Rust unit tests
npm run build:desktop # produce a desktop bundle for the current OS
```

## Using an AI provider

The app is fully usable for requirements and diagrams without a provider. For AI features, open Settings, choose a provider, paste an API key, test the connection, and pick a model.

- API usage is billed by the provider, separately from any ChatGPT or Claude consumer subscription. A subscription does not include API access.
- Model names change. The defaults in `src/ai/provider-registry.ts` may be outdated; the connection test lists the models your key can use, and you can type any model identifier.
- When you click an AI action, your requirements, architecture, decisions, open findings, recent messages, and illustrative reference notes for the problem are sent directly to the provider. The app shows this before you send anything.
- Keys are stored in Keychain (macOS) or Credential Manager (Windows). They are never written to the database, files, or logs.

## How the interview works

1. Pick a problem and read the statement.
2. Clarify requirements and record assumptions and capacity estimates.
3. Build the architecture; fill in responsibilities, failure behaviour, and scaling notes where useful.
4. Ask the interviewer for a question, a requirements discovery prompt, a review, or a failure scenario. Answer in the chat; the interviewer evaluates your reasoning and may ask a deeper follow-up.
5. Change the design or requirements; the next review uses the updated state and highlights what changed.
6. Generate a summary with risks, trade-offs, and topics to practise.

Feedback evaluates your design against your own requirements. Multiple architectures can be valid.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Third-party licenses](docs/THIRD_PARTY_LICENSES.md)

## Known limitations

- Responses are not streamed; a turn appears when complete.
- Model support is validated at request time. Native JSON mode is used only for OpenAI; Anthropic output is validated locally.
- Release builds are unsigned. macOS may require right-click, Open on first launch; Windows SmartScreen may warn.
- The Windows build and CI jobs have not been run; the app has been built and launched on macOS only.
- No end-to-end UI automation yet; the canvas is covered by manual testing and model-level tests.
- Performance has not been benchmarked. See the baseline plan in the architecture document.
- The database is not encrypted at rest.
- AI feedback may be incomplete or wrong. Use your own engineering judgment.

## Roadmap

Streaming, export and import, more problems, signed releases, performance baselining, richer end-to-end tests.

## Contributing

Contributions, bug reports, and architecture discussions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

DesignGrill is an educational practice tool. AI-generated feedback may be incomplete or incorrect. API usage may incur charges from your chosen provider.
