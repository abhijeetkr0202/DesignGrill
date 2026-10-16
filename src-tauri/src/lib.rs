mod ai_http;
mod credentials;
mod db;
mod error;

use ai_http::{AiRequest, AiResponse, AiState};
use db::{Database, SessionMeta, SessionRecord};
use error::AppError;
use tauri::{Manager, State};

pub struct AppState {
    db: Result<Database, String>,
    ai: Result<AiState, String>,
}

impl AppState {
    fn db(&self) -> Result<&Database, AppError> {
        self.db.as_ref().map_err(|e| AppError::Database(e.clone()))
    }
}

#[tauri::command]
async fn session_list(state: State<'_, AppState>) -> Result<Vec<SessionMeta>, AppError> {
    state.db()?.list_sessions()
}

#[tauri::command]
async fn session_load(state: State<'_, AppState>, id: String) -> Result<SessionRecord, AppError> {
    state
        .db()?
        .load_session(&id)?
        .ok_or_else(|| AppError::NotFound(format!("session {id}")))
}

#[tauri::command]
async fn session_save(state: State<'_, AppState>, record: SessionRecord) -> Result<(), AppError> {
    state.db()?.save_session(&record)
}

#[tauri::command]
async fn session_delete(state: State<'_, AppState>, id: String) -> Result<bool, AppError> {
    state.db()?.delete_session(&id)
}

#[tauri::command]
async fn problem_upsert(
    state: State<'_, AppState>,
    id: String,
    version: i64,
    title: String,
    content_hash: Option<String>,
    updated_at: String,
) -> Result<(), AppError> {
    state
        .db()?
        .upsert_problem(&id, version, &title, content_hash.as_deref(), &updated_at)
}

#[tauri::command]
async fn preference_list(state: State<'_, AppState>) -> Result<Vec<(String, String)>, AppError> {
    state.db()?.list_preferences()
}

#[tauri::command]
async fn preference_set(
    state: State<'_, AppState>,
    key: String,
    value: Option<String>,
) -> Result<(), AppError> {
    state.db()?.set_preference(&key, value.as_deref())
}

#[tauri::command]
async fn credential_set(provider: String, key: String) -> Result<(), AppError> {
    credentials::set_key(&provider, &key)
}

#[tauri::command]
async fn credential_status(provider: String) -> Result<bool, AppError> {
    Ok(credentials::get_key(&provider)?.is_some())
}

#[tauri::command]
async fn credential_delete(provider: String) -> Result<(), AppError> {
    credentials::delete_key(&provider)
}

#[tauri::command]
async fn ai_http_request(
    state: State<'_, AppState>,
    request: AiRequest,
) -> Result<AiResponse, AppError> {
    let ai = state.ai.as_ref().map_err(|e| AppError::Ai {
        kind: "network",
        message: e.clone(),
    })?;
    ai.request(request).await
}

#[tauri::command]
async fn ai_cancel(state: State<'_, AppState>, request_id: String) -> Result<(), AppError> {
    if let Ok(ai) = state.ai.as_ref() {
        ai.cancel(&request_id);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())
                .and_then(|dir| {
                    Database::open(&dir.join("designgrill.db")).map_err(|e| e.to_string())
                });
            if let Err(e) = &db {
                eprintln!("DesignGrill: database unavailable: {e}");
            }
            let ai = AiState::new().map_err(|e| e.to_string());
            app.manage(AppState { db, ai });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session_list,
            session_load,
            session_save,
            session_delete,
            problem_upsert,
            preference_list,
            preference_set,
            credential_set,
            credential_status,
            credential_delete,
            ai_http_request,
            ai_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DesignGrill");
}
