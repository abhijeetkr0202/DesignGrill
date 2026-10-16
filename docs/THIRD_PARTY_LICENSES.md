# Third-party licenses

DesignGrill is MIT licensed. It depends on the open-source packages below. Licenses were taken from package metadata where available; verify with `npm ls` and `cargo tree` or a license-scanning tool before each release.

## Frontend (npm)

| Package                                                        | License                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| react, react-dom                                               | MIT                                                                                                         |
| @xyflow/react (React Flow)                                     | MIT. A small "React Flow" attribution is shown on the canvas; keep it unless you have the Pro subscription. |
| zustand                                                        | MIT                                                                                                         |
| zod                                                            | MIT                                                                                                         |
| @tauri-apps/api, @tauri-apps/cli                               | MIT or Apache-2.0                                                                                           |
| Tailwind CSS, @tailwindcss/vite                                | MIT                                                                                                         |
| Vite, @vitejs/plugin-react, Vitest                             | MIT                                                                                                         |
| TypeScript                                                     | Apache-2.0                                                                                                  |
| ESLint, typescript-eslint, eslint-plugin-react-hooks, Prettier | MIT (typescript-eslint, ESLint, Prettier), MIT (react-hooks)                                                |
| Testing Library, jsdom                                         | MIT                                                                                                         |

## Native (Rust)

| Crate                                        | License                             |
| -------------------------------------------- | ----------------------------------- |
| tauri, tauri-build                           | Apache-2.0 or MIT                   |
| rusqlite (with bundled SQLite)               | MIT; SQLite itself is public domain |
| keyring and platform credential-store crates | MIT or Apache-2.0                   |
| reqwest, native-tls                          | MIT or Apache-2.0                   |
| tokio                                        | MIT                                 |
| serde, serde_json, thiserror                 | MIT or Apache-2.0                   |

Transitive dependencies carry their own licenses; none are intended to impose terms stricter than these.

## Content

Interview problem content under `content/` and prompts under `src/ai/prompts/` are original works released under the project's MIT License.
