# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Include the affected version, steps to reproduce, and the impact you observed. You will get an acknowledgement and a status update as the report is investigated. Please allow time for a fix before public disclosure.

Maintainers: enable "Private vulnerability reporting" under Settings, Code security.

## Supported versions

DesignGrill is pre-1.0. Only the latest release receives security fixes.

## Security model

- **Local-first.** Sessions live in a SQLite database in the platform application-data directory. There is no DesignGrill server and no telemetry.
- **API keys** are written to the operating system credential store (Keychain on macOS, Credential Manager on Windows) by the native layer. No command returns a stored key to the webview, and keys are never written to SQLite, files, logs, or the frontend state. Keys are not passed on command lines.
- **Outbound requests** to AI providers are made by the native layer, not by the webview. Hosts are fixed per provider (HTTPS only), request paths are validated, redirects are refused, and response bodies are redacted of the key before they reach the UI.
- **Least privilege.** The Tauri capability file allows only DesignGrill's own commands. No shell, filesystem, or HTTP plugin permissions are granted to the webview. The content security policy is restrictive (`default-src 'self'`, `connect-src` limited to the IPC channel).
- **Untrusted model output.** AI responses are parsed and validated against schemas before use. Findings may only reference components and requirements that exist. The model cannot change the architecture; it can only suggest. Candidate text and design content are sent as delimited data and the system prompt instructs the model to ignore instructions inside them. This reduces but cannot eliminate prompt-injection risk.
- **No automatic execution.** Model output is never executed as code or shell commands.

## Known limitations

- Release builds are currently unsigned.
- Prompt-injection defences are best-effort.
- Data in the SQLite database is not encrypted at rest; it relies on operating-system account protections.
