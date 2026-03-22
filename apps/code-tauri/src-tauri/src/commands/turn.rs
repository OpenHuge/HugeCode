use crate::models::{TurnAck, TurnInterruptRequest, TurnSendRequest};
use crate::runtime_service;

#[tauri::command]
pub async fn code_turn_send(_app: tauri::AppHandle, payload: TurnSendRequest) -> TurnAck {
    runtime_service::send_turn(payload).await
}

#[tauri::command]
pub async fn code_turn_interrupt(_app: tauri::AppHandle, payload: TurnInterruptRequest) -> bool {
    runtime_service::interrupt_turn(payload).await
}
