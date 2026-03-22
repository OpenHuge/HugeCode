use crate::backend::runtime_backend;
use crate::models::{ModelPoolEntry, RuntimeProviderCatalogEntry};

#[tauri::command]
pub fn code_models_pool() -> Vec<ModelPoolEntry> {
    runtime_backend().model_pool()
}

#[tauri::command]
pub fn code_providers_catalog() -> Vec<RuntimeProviderCatalogEntry> {
    runtime_backend().provider_catalog()
}
