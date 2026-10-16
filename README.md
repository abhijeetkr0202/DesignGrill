DesignGrill

Your architecture. Under pressure.

DesignGrill is an open-source, AI-powered system design interview coach that helps software engineers practice designing scalable, reliable, and maintainable systems.

Design an architecture on an interactive canvas, document functional and non-functional requirements, and let an AI interviewer challenge your decisions with realistic follow-up questions and failure scenarios.

Why DesignGrill?

System design is best learned by defending your decisions, exploring trade-offs, and understanding how systems behave under stress. But practicing alone makes it difficult to get meaningful feedback.

DesignGrill aims to provide an interactive interview experience where your architecture, requirements, and discussion stay synchronized.

Planned Features

* Interactive architecture canvas — design systems visually using components and connections.
* Requirements workspace — define and refine functional requirements, non-functional requirements, assumptions, and constraints.
* AI architecture critique — identify potential bottlenecks, single points of failure, scalability concerns, and architectural trade-offs.
* Adaptive interview mode — receive follow-up questions based on your actual design decisions.
* Interview problem library — practice common problems such as URL shorteners, notification systems, shopping carts, and payment systems.
* Reference architectures — explore alternative designs, failure scenarios, and common engineering trade-offs.
* Local-first storage — save your designs and practice sessions on your device.
* Bring your own API key — configure supported AI providers through the application settings.
* Cross-platform desktop app — target macOS and Windows from a shared codebase.
* Voice interview mode — planned for a later release.

Technology Stack

The initial implementation is planned around:

* Desktop framework: Tauri 2
* Frontend: React and TypeScript
* Architecture canvas: React Flow
* Styling: Tailwind CSS
* State management: Zustand
* Local database: SQLite
* Native functionality: Rust
* AI integration: Provider adapter layer for supported LLM APIs
* CI/CD: GitHub Actions for cross-platform builds and releases

The stack may evolve as development progresses.

Design Principles

* Local-first and privacy-conscious.
* Lightweight resource usage.
* Open source and community-driven.
* Provider-independent AI integration.
* Architecture feedback grounded in requirements, constraints, and trade-offs.
* No single assumed perfect architecture; multiple viable solutions should be considered.

Project Status

🚧 Early development — the initial MVP is being planned.

The first milestone is a working desktop application with a requirements editor, an architecture canvas, local persistence, and AI-powered text-based design reviews.

Voice interaction, advanced architecture analysis, and additional interview scenarios will follow incrementally.

Contributing

Contributions, bug reports, feature suggestions, and architecture discussions are welcome.

See CONTRIBUTING.md for contribution guidelines once available.

License

DesignGrill is intended to be released under the MIT License. See LICENSE for details.

Disclaimer

DesignGrill is an educational practice tool. AI-generated feedback may be incomplete or incorrect and should be evaluated using engineering judgment. API usage may incur charges from your chosen provider.