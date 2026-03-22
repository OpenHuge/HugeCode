use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub app: String,
    pub version: String,
    pub status: String,
}

#[tauri::command]
pub fn code_health() -> HealthResponse {
    HealthResponse {
        app: "code-tauri".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        status: "ok".to_string(),
    }
}
