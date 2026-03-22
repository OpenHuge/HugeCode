use super::*;
use crate::native_state_store::TABLE_NATIVE_SETTINGS_KV;

const APP_SETTINGS_STORAGE_KEY: &str = "app.settings";

pub(super) async fn handle_app_settings_get(ctx: &AppContext) -> Result<Value, RpcError> {
    let persisted = ctx
        .native_state_store
        .get_setting_value(TABLE_NATIVE_SETTINGS_KV, APP_SETTINGS_STORAGE_KEY)
        .await
        .map_err(RpcError::internal)?;

    Ok(match persisted {
        Some(Value::Object(settings)) => Value::Object(settings),
        Some(_) => {
            return Err(RpcError::internal(
                "persisted app settings payload must be a JSON object",
            ))
        }
        None => Value::Object(serde_json::Map::new()),
    })
}

pub(super) async fn handle_app_settings_update(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let payload = params
        .get("payload")
        .cloned()
        .unwrap_or_else(|| Value::Object(params.clone()));

    let Value::Object(settings) = payload else {
        return Err(RpcError::invalid_params(
            "app settings payload must be a JSON object",
        ));
    };

    let persisted = ctx
        .native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_SETTINGS_KV,
            APP_SETTINGS_STORAGE_KEY,
            Value::Object(settings),
        )
        .await
        .map_err(RpcError::internal)?;

    Ok(persisted.get("value").cloned().unwrap_or(Value::Null))
}
