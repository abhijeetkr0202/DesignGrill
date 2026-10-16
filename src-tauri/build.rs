const COMMANDS: &[&str] = &[
    "session_list",
    "session_load",
    "session_save",
    "session_delete",
    "problem_upsert",
    "preference_list",
    "preference_set",
    "credential_set",
    "credential_status",
    "credential_delete",
    "ai_http_request",
    "ai_cancel",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
