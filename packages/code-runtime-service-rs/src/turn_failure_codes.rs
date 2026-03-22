pub(crate) fn resolve_turn_failure_code(message: &str) -> &'static str {
    let normalized = message.trim().to_ascii_lowercase();
    if normalized.contains("turn interrupted") {
        "TASK_INTERRUPTED"
    } else if normalized.contains("failed to read chatgpt codex response stream")
        || normalized.contains("error decoding response body")
    {
        "runtime.turn.provider.stream_read_failed"
    } else {
        "TURN_EXECUTION_FAILED"
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_turn_failure_code;

    #[test]
    fn classify_stream_read_failures() {
        let code = resolve_turn_failure_code(
            "Failed to read ChatGPT Codex response stream: error decoding response body",
        );
        assert_eq!(code, "runtime.turn.provider.stream_read_failed");
    }
}
