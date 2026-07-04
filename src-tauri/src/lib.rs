use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, Runtime};

const STATE_FILE_NAME: &str = "state.json";

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct PersistedState {
    pub schema_version: u32,
    pub json: String, // serialized AppState from the frontend
}

fn state_path<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("create dir failed: {e}"))?;
    }
    Ok(dir.join(STATE_FILE_NAME))
}

#[tauri::command]
fn load_state<R: Runtime>(app: tauri::AppHandle<R>) -> Result<PersistedState, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(PersistedState {
            schema_version: 1,
            json: String::new(),
        });
    }
    let bytes = fs::read(&path).map_err(|e| format!("read failed: {e}"))?;
    if bytes.is_empty() {
        return Ok(PersistedState {
            schema_version: 1,
            json: String::new(),
        });
    }
    serde_json::from_slice::<PersistedState>(&bytes).map_err(|e| format!("parse failed: {e}"))
}

#[tauri::command]
fn save_state<R: Runtime>(app: tauri::AppHandle<R>, state: PersistedState) -> Result<(), String> {
    let path = state_path(&app)?;
    let bytes = serde_json::to_vec_pretty(&state).map_err(|e| format!("serialize failed: {e}"))?;
    // Write to a temp file then atomically rename so we never half-write.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, &bytes).map_err(|e| format!("tmp write failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename failed: {e}"))?;
    Ok(())
}

#[tauri::command]
fn state_location<R: Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    Ok(state_path(&app)?.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            state_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
