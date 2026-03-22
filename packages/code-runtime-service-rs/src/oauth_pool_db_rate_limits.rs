fn normalize_retry_after_seconds(retry_after_sec: Option<u64>) -> Option<u64> {
    retry_after_sec.map(|seconds| seconds.max(1).min(OAUTH_RATE_LIMIT_RETRY_AFTER_MAX_SEC))
}

fn normalize_reported_reset_at(reset_at: Option<u64>, now: u64) -> Option<u64> {
    let reset_at = reset_at?;
    if reset_at <= now {
        return None;
    }
    Some(
        reset_at.min(
            now.saturating_add(OAUTH_RATE_LIMIT_RESET_MAX_WINDOW_MS),
        ),
    )
}

fn is_rate_limit_signal(error_code: Option<&str>, error_message: Option<&str>) -> bool {
    let code = error_code
        .map(|entry| entry.trim().to_ascii_lowercase())
        .unwrap_or_default();
    let message = error_message
        .map(|entry| entry.to_ascii_lowercase())
        .unwrap_or_default();

    code.contains("rate_limit")
        || code.contains("too_many_requests")
        || code.contains("throttle")
        || code.contains("quota")
        || code.contains("resource_exhausted")
        || code.contains("quota_exceeded")
        || code.contains("insufficient_quota")
        || code.contains("429")
        || message.contains("rate limit")
        || message.contains("too many requests")
        || message.contains("throttle")
        || message.contains("quota")
        || message.contains("resource_exhausted")
        || message.contains("quota exceeded")
        || message.contains("exceeded your current quota")
        || message.contains("slow down")
        || message.contains("too frequent")
        || message.contains("请求过于频繁")
        || message.contains("请求频率过高")
        || message.contains("配额已用尽")
        || message.contains("429")
}

fn fallback_rate_limit_reset_at(
    now: u64,
    failure_count: i32,
    account_id: &str,
    scope_model: &str,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Option<u64> {
    if !is_rate_limit_signal(error_code, error_message) {
        return None;
    }

    let bounded_failures = failure_count.max(1).min(OAUTH_RATE_LIMIT_FALLBACK_FAILURE_CAP) as u32;
    let exponent = bounded_failures.saturating_sub(1);
    let factor = 1_u64.checked_shl(exponent).unwrap_or(1);
    let base_cooldown_sec = OAUTH_RATE_LIMIT_FALLBACK_BASE_SEC
        .saturating_mul(factor)
        .min(OAUTH_RATE_LIMIT_FALLBACK_MAX_SEC);
    let jitter_bps =
        deterministic_rate_limit_jitter_bps(account_id, scope_model, bounded_failures as i32);
    let cooldown_sec = base_cooldown_sec
        .saturating_mul(jitter_bps)
        .saturating_div(1000)
        .clamp(1, OAUTH_RATE_LIMIT_FALLBACK_MAX_SEC);
    Some(now.saturating_add(cooldown_sec.saturating_mul(1000)))
}

fn deterministic_rate_limit_jitter_bps(account_id: &str, scope_model: &str, failure_count: i32) -> u64 {
    const MIN_JITTER_BPS: u64 = 850;
    const MAX_JITTER_BPS: u64 = 1200;
    use std::hash::{Hash, Hasher};

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    account_id.hash(&mut hasher);
    scope_model.hash(&mut hasher);
    failure_count.hash(&mut hasher);

    let span = MAX_JITTER_BPS
        .saturating_sub(MIN_JITTER_BPS)
        .saturating_add(1);
    MIN_JITTER_BPS + (hasher.finish() % span.max(1))
}

fn merge_rate_limit_reset(
    previous_reset_at: Option<u64>,
    computed_reset_at: Option<u64>,
    now: u64,
) -> Option<u64> {
    let previous_active = previous_reset_at.filter(|reset_at| *reset_at > now);
    match (previous_active, computed_reset_at) {
        (Some(previous), Some(computed)) => Some(previous.max(computed)),
        (Some(previous), None) => Some(previous),
        (None, Some(computed)) => Some(computed),
        (None, None) => None,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
