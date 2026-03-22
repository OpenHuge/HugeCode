use super::*;
use std::time::{Duration, Instant};

pub(super) fn list_local_cli_sessions(limit: usize, scan_budget_ms: u64) -> Vec<CliSessionSummary> {
    let Some(root) = resolve_local_codex_sessions_root() else {
        return Vec::new();
    };
    collect_local_cli_sessions(root.as_path(), limit, Duration::from_millis(scan_budget_ms))
}

fn collect_local_cli_sessions(
    root: &Path,
    limit: usize,
    scan_budget: Duration,
) -> Vec<CliSessionSummary> {
    if !root.exists() || limit == 0 || scan_budget.is_zero() {
        return Vec::new();
    }

    let mut sessions_by_id: HashMap<String, CliSessionSummary> = HashMap::new();
    let mut stack = vec![root.to_path_buf()];
    let scan_started_at = Instant::now();
    let scan_deadline = scan_started_at.checked_add(scan_budget);

    'scan: while let Some(next_dir) = stack.pop() {
        if is_scan_budget_exhausted(scan_deadline) {
            break;
        }
        let Ok(entries) = fs::read_dir(next_dir) else {
            continue;
        };

        for entry in entries.flatten() {
            if is_scan_budget_exhausted(scan_deadline) {
                break 'scan;
            }
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                stack.push(path);
                continue;
            }
            if !file_type.is_file() || !is_rollout_jsonl_file(path.as_path()) {
                continue;
            }

            let updated_at = entry
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(system_time_to_epoch_ms)
                .unwrap_or(0);
            if let Some(summary) =
                parse_local_cli_rollout_with_deadline(path.as_path(), updated_at, scan_deadline)
            {
                let session_id = summary.session_id.clone();
                match sessions_by_id.get(&session_id) {
                    Some(existing) if existing.updated_at >= summary.updated_at => {}
                    _ => {
                        sessions_by_id.insert(session_id, summary);
                    }
                }
            }
        }
    }

    let mut sessions: Vec<CliSessionSummary> = sessions_by_id.into_values().collect();
    sessions.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.session_id.cmp(&right.session_id))
    });
    if sessions.len() > limit {
        sessions.truncate(limit);
    }
    sessions
}

fn is_scan_budget_exhausted(scan_deadline: Option<Instant>) -> bool {
    scan_deadline.is_some_and(|deadline| Instant::now() >= deadline)
}

fn is_rollout_jsonl_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("jsonl"))
        .unwrap_or(false)
}

fn parse_session_started_at_from_rollout_path(path: &Path) -> Option<u64> {
    let file_name = path.file_name()?.to_str()?.trim();
    let stem = file_name
        .strip_prefix("rollout-")
        .and_then(|value| value.strip_suffix(".jsonl"))?;
    parse_rollout_timestamp_prefix_to_epoch_ms(stem)
}

fn parse_session_id_from_event(event: &Value) -> Option<String> {
    event
        .get("payload")
        .and_then(Value::as_object)
        .and_then(|payload| payload.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn parse_session_id_from_rollout_path(path: &Path) -> Option<String> {
    let file_name = path.file_name()?.to_str()?.trim();
    let stem = file_name
        .strip_prefix("rollout-")
        .and_then(|value| value.strip_suffix(".jsonl"))?;
    if stem.len() <= 20 {
        return None;
    }
    let session_id = &stem[20..];
    let trimmed = session_id.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

fn parse_model_from_event(event: &Value) -> Option<String> {
    let payload = event.get("payload").and_then(Value::as_object)?;
    ["model", "model_id", "modelId", "model_slug", "active_model"]
        .iter()
        .find_map(|key| parse_optional_non_empty_string(payload.get(*key)))
}

#[derive(Clone, Copy, Default)]
struct CliSessionTokenUsage {
    input_tokens: u64,
    cached_input_tokens: u64,
    output_tokens: u64,
    total_tokens: u64,
}

impl CliSessionTokenUsage {
    fn has_any(&self) -> bool {
        self.input_tokens > 0
            || self.cached_input_tokens > 0
            || self.output_tokens > 0
            || self.total_tokens > 0
    }
}

fn parse_optional_non_negative_u64(value: Option<&Value>) -> Option<u64> {
    match value {
        Some(Value::Number(number)) => number
            .as_u64()
            .or_else(|| number.as_i64().and_then(|entry| u64::try_from(entry).ok())),
        _ => None,
    }
}

fn parse_token_usage_field(payload: &serde_json::Map<String, Value>, snake_case_key: &str) -> u64 {
    let camel_case_key = snake_to_camel(snake_case_key);
    parse_optional_non_negative_u64(payload.get(snake_case_key))
        .or_else(|| parse_optional_non_negative_u64(payload.get(camel_case_key.as_str())))
        .unwrap_or(0)
}

fn parse_token_usage_payload(value: &Value) -> Option<CliSessionTokenUsage> {
    let payload = value.as_object()?;
    let input_tokens = parse_token_usage_field(payload, "input_tokens");
    let cached_input_tokens = parse_token_usage_field(payload, "cached_input_tokens");
    let output_tokens = parse_token_usage_field(payload, "output_tokens");
    let explicit_total_tokens = parse_token_usage_field(payload, "total_tokens");
    let total_tokens = if explicit_total_tokens > 0 {
        explicit_total_tokens
    } else {
        input_tokens
            .saturating_add(cached_input_tokens)
            .saturating_add(output_tokens)
    };
    let usage = CliSessionTokenUsage {
        input_tokens,
        cached_input_tokens,
        output_tokens,
        total_tokens,
    };
    usage.has_any().then_some(usage)
}

fn merge_token_usage_max(
    current: Option<CliSessionTokenUsage>,
    candidate: CliSessionTokenUsage,
) -> CliSessionTokenUsage {
    let mut merged = current.unwrap_or_default();
    merged.input_tokens = merged.input_tokens.max(candidate.input_tokens);
    merged.cached_input_tokens = merged
        .cached_input_tokens
        .max(candidate.cached_input_tokens);
    merged.output_tokens = merged.output_tokens.max(candidate.output_tokens);
    merged.total_tokens = merged.total_tokens.max(candidate.total_tokens);
    merged
}

fn parse_token_usage_from_event(
    event: &Value,
    cumulative_usage: &mut Option<CliSessionTokenUsage>,
    last_usage_sum: &mut CliSessionTokenUsage,
) {
    let payload = match event.get("payload").and_then(Value::as_object) {
        Some(payload) => payload,
        None => return,
    };
    if payload
        .get("type")
        .and_then(Value::as_str)
        .is_none_or(|entry| !entry.eq_ignore_ascii_case("token_count"))
    {
        return;
    }
    let info = match payload.get("info").and_then(Value::as_object) {
        Some(info) => info,
        None => return,
    };

    if let Some(total_usage) = info
        .get("total_token_usage")
        .and_then(parse_token_usage_payload)
    {
        *cumulative_usage = Some(merge_token_usage_max(*cumulative_usage, total_usage));
    }
    if let Some(last_usage) = info
        .get("last_token_usage")
        .and_then(parse_token_usage_payload)
    {
        last_usage_sum.input_tokens = last_usage_sum
            .input_tokens
            .saturating_add(last_usage.input_tokens);
        last_usage_sum.cached_input_tokens = last_usage_sum
            .cached_input_tokens
            .saturating_add(last_usage.cached_input_tokens);
        last_usage_sum.output_tokens = last_usage_sum
            .output_tokens
            .saturating_add(last_usage.output_tokens);
        last_usage_sum.total_tokens = last_usage_sum
            .total_tokens
            .saturating_add(last_usage.total_tokens);
    }
}

#[cfg(test)]
fn parse_local_cli_rollout(path: &Path, updated_at: u64) -> Option<CliSessionSummary> {
    parse_local_cli_rollout_with_deadline(path, updated_at, None)
}

fn parse_local_cli_rollout_with_deadline(
    path: &Path,
    updated_at: u64,
    scan_deadline: Option<Instant>,
) -> Option<CliSessionSummary> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut first_line = Vec::new();
    let line_size = reader
        .by_ref()
        .take((MAX_ROLLOUT_FIRST_LINE_BYTES as u64) + 1)
        .read_until(b'\n', &mut first_line)
        .ok()?;
    if line_size == 0 || line_size > MAX_ROLLOUT_FIRST_LINE_BYTES {
        return None;
    }
    while first_line
        .last()
        .is_some_and(|byte| *byte == b'\n' || *byte == b'\r')
    {
        first_line.pop();
    }
    let first_line = String::from_utf8(first_line).ok()?;
    let first_event: Value = serde_json::from_str(first_line.trim()).ok()?;
    let session_id = parse_session_id_from_event(&first_event)
        .or_else(|| parse_session_id_from_rollout_path(path))?;
    let started_at = parse_session_started_at_from_event(&first_event)
        .or_else(|| parse_session_started_at_from_rollout_path(path));
    let event_type = first_event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let cwd = if event_type == "session_meta" {
        first_event
            .get("payload")
            .and_then(Value::as_object)
            .and_then(|payload| parse_optional_non_empty_string(payload.get("cwd")))
    } else {
        None
    };

    let mut session = CliSessionSummary {
        session_id,
        updated_at,
        path: path.to_string_lossy().to_string(),
        started_at,
        cwd,
        model: parse_model_from_event(&first_event),
        input_tokens: None,
        cached_input_tokens: None,
        output_tokens: None,
        total_tokens: None,
    };

    let mut cumulative_usage: Option<CliSessionTokenUsage> = None;
    let mut last_usage_sum = CliSessionTokenUsage::default();
    parse_token_usage_from_event(&first_event, &mut cumulative_usage, &mut last_usage_sum);
    parse_rollout_usage_and_model(
        &mut reader,
        &mut session,
        &mut cumulative_usage,
        &mut last_usage_sum,
        scan_deadline,
    );

    let token_usage =
        cumulative_usage.or_else(|| last_usage_sum.has_any().then_some(last_usage_sum));
    session.input_tokens = token_usage.map(|usage| usage.input_tokens);
    session.cached_input_tokens = token_usage.map(|usage| usage.cached_input_tokens);
    session.output_tokens = token_usage.map(|usage| usage.output_tokens);
    session.total_tokens = token_usage.map(|usage| usage.total_tokens);

    Some(session)
}

fn parse_rollout_usage_and_model(
    reader: &mut BufReader<File>,
    session: &mut CliSessionSummary,
    cumulative_usage: &mut Option<CliSessionTokenUsage>,
    last_usage_sum: &mut CliSessionTokenUsage,
    scan_deadline: Option<Instant>,
) {
    let mut line = Vec::new();
    loop {
        if is_scan_budget_exhausted(scan_deadline) {
            break;
        }
        line.clear();
        let Ok(bytes_read) = reader
            .by_ref()
            .take((MAX_ROLLOUT_FIRST_LINE_BYTES as u64) + 1)
            .read_until(b'\n', &mut line)
        else {
            break;
        };
        if bytes_read == 0 {
            break;
        }
        if bytes_read > MAX_ROLLOUT_FIRST_LINE_BYTES {
            break;
        }
        while line
            .last()
            .is_some_and(|byte| *byte == b'\n' || *byte == b'\r')
        {
            line.pop();
        }
        let Ok(trimmed) = std::str::from_utf8(line.as_slice()) else {
            continue;
        };
        let trimmed = trimmed.trim();
        if trimmed.is_empty() {
            continue;
        }

        let likely_contains_model = session.model.is_none() && trimmed.contains("\"model");
        let likely_contains_usage = trimmed.contains("token_count");
        if !likely_contains_model && !likely_contains_usage {
            continue;
        }

        let Ok(event) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if session.model.is_none() {
            session.model = parse_model_from_event(&event);
        }
        parse_token_usage_from_event(&event, cumulative_usage, last_usage_sum);
    }
}

fn parse_session_started_at_from_event(event: &Value) -> Option<u64> {
    let payload = event.get("payload").and_then(Value::as_object);
    let timestamp = payload
        .and_then(|entry| parse_optional_non_empty_string(entry.get("timestamp")))
        .or_else(|| parse_optional_non_empty_string(event.get("timestamp")))?;
    parse_rfc3339_utc_to_epoch_ms(timestamp.as_str())
}

fn parse_rollout_timestamp_prefix_to_epoch_ms(input: &str) -> Option<u64> {
    let trimmed = input.trim();
    if trimmed.len() < 19 {
        return None;
    }
    let prefix = &trimmed[..19];
    let bytes = prefix.as_bytes();
    if bytes.get(4).copied() != Some(b'-')
        || bytes.get(7).copied() != Some(b'-')
        || bytes.get(10).copied() != Some(b'T')
        || bytes.get(13).copied() != Some(b'-')
        || bytes.get(16).copied() != Some(b'-')
    {
        return None;
    }

    let year = prefix.get(0..4)?.parse::<i32>().ok()?;
    let month = prefix.get(5..7)?.parse::<u8>().ok()?;
    let day = prefix.get(8..10)?.parse::<u8>().ok()?;
    let hour = prefix.get(11..13)?.parse::<u8>().ok()?;
    let minute = prefix.get(14..16)?.parse::<u8>().ok()?;
    let second = prefix.get(17..19)?.parse::<u8>().ok()?;

    datetime_to_epoch_ms(year, month, day, hour, minute, second, 0)
}

fn parse_rfc3339_utc_to_epoch_ms(input: &str) -> Option<u64> {
    let trimmed = input.trim();
    let raw = trimmed
        .strip_suffix('Z')
        .or_else(|| trimmed.strip_suffix('z'))?;
    let (date_raw, time_raw) = raw.split_once('T')?;
    let mut date_parts = date_raw.split('-');
    let year = date_parts.next()?.parse::<i32>().ok()?;
    let month = date_parts.next()?.parse::<u8>().ok()?;
    let day = date_parts.next()?.parse::<u8>().ok()?;
    if date_parts.next().is_some() {
        return None;
    }

    let mut time_parts = time_raw.split(':');
    let hour = time_parts.next()?.parse::<u8>().ok()?;
    let minute = time_parts.next()?.parse::<u8>().ok()?;
    let second_and_fraction = time_parts.next()?;
    if time_parts.next().is_some() {
        return None;
    }
    let (second_raw, fraction_raw) = match second_and_fraction.split_once('.') {
        Some((second, fraction)) => (second, Some(fraction)),
        None => (second_and_fraction, None),
    };
    let second = second_raw.parse::<u8>().ok()?;
    let millis = match fraction_raw {
        Some(value) => {
            let digits: String = value
                .chars()
                .take_while(|ch| ch.is_ascii_digit())
                .take(3)
                .collect();
            if digits.is_empty() {
                0
            } else {
                format!("{digits:0<3}").parse::<u16>().ok()?
            }
        }
        None => 0,
    };

    datetime_to_epoch_ms(year, month, day, hour, minute, second, millis)
}

fn datetime_to_epoch_ms(
    year: i32,
    month: u8,
    day: u8,
    hour: u8,
    minute: u8,
    second: u8,
    millisecond: u16,
) -> Option<u64> {
    let month = time::Month::try_from(month).ok()?;
    let date = time::Date::from_calendar_date(year, month, day).ok()?;
    let time = time::Time::from_hms_milli(hour, minute, second, millisecond).ok()?;
    let datetime = time::PrimitiveDateTime::new(date, time).assume_utc();
    let epoch_nanos = datetime.unix_timestamp_nanos();
    if epoch_nanos < 0 {
        return None;
    }
    Some((epoch_nanos as u128 / 1_000_000) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, io::Write, thread::sleep, time::Duration as StdDuration};
    use uuid::Uuid;

    struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let path = env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
            fs::create_dir_all(path.as_path()).expect("create temp dir");
            Self { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }

    fn write_rollout(path: &Path, first_event: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create rollout parent");
        }
        let mut file = File::create(path).expect("create rollout file");
        writeln!(file, "{first_event}").expect("write rollout event");
        file.flush().expect("flush rollout file");
    }

    fn write_rollout_lines(path: &Path, lines: &[&str]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create rollout parent");
        }
        let mut file = File::create(path).expect("create rollout file");
        for line in lines {
            writeln!(file, "{line}").expect("write rollout event line");
        }
        file.flush().expect("flush rollout file");
    }

    #[test]
    fn parse_session_started_at_from_rollout_path_parses_prefix() {
        let path = Path::new("/tmp/rollout-2025-12-03T01-30-28-abc.jsonl");
        let parsed = parse_session_started_at_from_rollout_path(path);
        assert_eq!(
            parsed,
            parse_rfc3339_utc_to_epoch_ms("2025-12-03T01:30:28Z")
        );
    }

    #[test]
    fn parse_session_started_at_from_event_parses_rfc3339_timestamp() {
        let event = json!({
            "type": "session_meta",
            "payload": {
                "id": "session-1",
                "timestamp": "2025-12-03T09:30:28.041Z"
            }
        });
        let started_at = parse_session_started_at_from_event(&event);
        assert_eq!(
            started_at,
            parse_rfc3339_utc_to_epoch_ms("2025-12-03T09:30:28.041Z")
        );
    }

    #[test]
    fn parse_session_id_from_rollout_path_falls_back_to_suffix() {
        let path = Path::new("/tmp/rollout-2025-12-03T01-30-28-abc-123.jsonl");
        assert_eq!(
            parse_session_id_from_rollout_path(path),
            Some("abc-123".to_string())
        );
    }

    #[test]
    fn parse_local_cli_rollout_uses_path_session_id_when_payload_id_missing() {
        let temp = TempDir::new("codex-cli-session-id-fallback");
        let file = temp
            .path
            .join("2025")
            .join("12")
            .join("03")
            .join("rollout-2025-12-03T01-30-28-session-fallback.jsonl");
        let event = r#"{"type":"session_meta","payload":{"cwd":"/tmp/project","timestamp":"2025-12-03T01:30:28.000Z"}}"#;
        write_rollout(file.as_path(), event);

        let session = parse_local_cli_rollout(file.as_path(), 0);
        assert_eq!(
            session.as_ref().map(|entry| entry.session_id.as_str()),
            Some("session-fallback")
        );
    }

    #[test]
    fn parse_local_cli_rollout_extracts_model_when_present() {
        let temp = TempDir::new("codex-cli-session-model");
        let file = temp
            .path
            .join("2025")
            .join("12")
            .join("03")
            .join("rollout-2025-12-03T01-30-28-session-model.jsonl");
        let event = r#"{"type":"session_meta","payload":{"id":"session-model","cwd":"/tmp/project","timestamp":"2025-12-03T01:30:28.000Z","model":"gpt-5.3-codex"}}"#;
        write_rollout(file.as_path(), event);

        let session = parse_local_cli_rollout(file.as_path(), 0);
        assert_eq!(
            session.as_ref().and_then(|entry| entry.model.as_deref()),
            Some("gpt-5.3-codex")
        );
    }

    #[test]
    fn parse_local_cli_rollout_extracts_token_usage_and_model_from_follow_up_events() {
        let temp = TempDir::new("codex-cli-session-token-usage");
        let file = temp
            .path
            .join("2026")
            .join("02")
            .join("13")
            .join("rollout-2026-02-13T05-00-00-session-token-usage.jsonl");
        write_rollout_lines(
            file.as_path(),
            &[
                r#"{"type":"session_meta","payload":{"id":"session-token-usage","cwd":"/tmp/project","timestamp":"2026-02-13T05:00:00.000Z"}}"#,
                r#"{"type":"turn_context","payload":{"model":"gpt-5.3-codex"}}"#,
                r#"{"type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":120,"cached_input_tokens":30,"output_tokens":50,"total_tokens":200}}}}"#,
                r#"{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":620,"cached_input_tokens":230,"output_tokens":450,"total_tokens":1300}}}}"#,
            ],
        );

        let session = parse_local_cli_rollout(file.as_path(), 0).expect("parse rollout");
        assert_eq!(session.model.as_deref(), Some("gpt-5.3-codex"));
        assert_eq!(session.input_tokens, Some(620));
        assert_eq!(session.cached_input_tokens, Some(230));
        assert_eq!(session.output_tokens, Some(450));
        assert_eq!(session.total_tokens, Some(1300));
    }

    #[test]
    fn parse_local_cli_rollout_rejects_oversized_first_line() {
        let temp = TempDir::new("codex-cli-session-oversized-line");
        let file = temp
            .path
            .join("2025")
            .join("12")
            .join("03")
            .join("rollout-2025-12-03T01-30-28-session-oversized.jsonl");
        if let Some(parent) = file.parent() {
            fs::create_dir_all(parent).expect("create rollout parent");
        }
        let mut output = File::create(file.as_path()).expect("create rollout file");
        let oversized = "x".repeat(MAX_ROLLOUT_FIRST_LINE_BYTES + 1);
        output
            .write_all(oversized.as_bytes())
            .expect("write oversized line");
        output.flush().expect("flush rollout file");

        assert!(parse_local_cli_rollout(file.as_path(), 0).is_none());
    }

    #[test]
    fn parse_local_cli_rollout_stops_follow_up_scan_when_budget_is_exhausted() {
        let temp = TempDir::new("codex-cli-session-budget-expired");
        let file = temp
            .path
            .join("2026")
            .join("02")
            .join("24")
            .join("rollout-2026-02-24T01-30-28-session-budget-expired.jsonl");
        write_rollout_lines(
            file.as_path(),
            &[
                r#"{"type":"session_meta","payload":{"id":"session-budget-expired","cwd":"/tmp/project","timestamp":"2026-02-24T01:30:28.000Z"}}"#,
                r#"{"type":"turn_context","payload":{"model":"gpt-5.3-codex"}}"#,
            ],
        );

        let session =
            parse_local_cli_rollout_with_deadline(file.as_path(), 0, Some(Instant::now()))
                .expect("parse rollout when budget expired");
        assert_eq!(session.model, None);
    }

    #[test]
    fn parse_local_cli_rollout_stops_on_oversized_follow_up_line() {
        let temp = TempDir::new("codex-cli-session-oversized-follow-up");
        let file = temp
            .path
            .join("2026")
            .join("02")
            .join("24")
            .join("rollout-2026-02-24T01-30-28-session-oversized-follow-up.jsonl");
        let oversized_line = "x".repeat(MAX_ROLLOUT_FIRST_LINE_BYTES + 1);
        write_rollout_lines(
            file.as_path(),
            &[
                r#"{"type":"session_meta","payload":{"id":"session-oversized-follow-up","cwd":"/tmp/project","timestamp":"2026-02-24T01:30:28.000Z","model":"gpt-5.3-codex"}}"#,
                oversized_line.as_str(),
                r#"{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":620,"cached_input_tokens":230,"output_tokens":450,"total_tokens":1300}}}}"#,
            ],
        );

        let session = parse_local_cli_rollout(file.as_path(), 0).expect("parse rollout");
        assert_eq!(session.model.as_deref(), Some("gpt-5.3-codex"));
        assert_eq!(session.input_tokens, None);
        assert_eq!(session.cached_input_tokens, None);
        assert_eq!(session.output_tokens, None);
        assert_eq!(session.total_tokens, None);
    }

    #[test]
    fn collect_local_cli_sessions_dedupes_same_session_id() {
        let temp = TempDir::new("codex-cli-session-dedupe");
        let root = temp.path.join("sessions");
        let day = root.join("2025").join("12").join("03");
        let first = day.join("rollout-2025-12-03T01-30-28-a.jsonl");
        let second = day.join("rollout-2025-12-03T01-31-28-b.jsonl");
        let first_event = r#"{"type":"session_meta","payload":{"id":"session-shared","cwd":"/tmp/one","timestamp":"2025-12-03T01:30:28.000Z"}}"#;
        let second_event = r#"{"type":"session_meta","payload":{"id":"session-shared","cwd":"/tmp/two","timestamp":"2025-12-03T01:31:28.000Z"}}"#;
        write_rollout(first.as_path(), first_event);
        sleep(StdDuration::from_millis(5));
        write_rollout(second.as_path(), second_event);

        let sessions = collect_local_cli_sessions(root.as_path(), 16, StdDuration::from_secs(5));
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, "session-shared");
        assert!(sessions[0].started_at.is_some());
    }

    #[test]
    fn collect_local_cli_sessions_respects_scan_budget_without_panicking() {
        let temp = TempDir::new("codex-cli-session-budget");
        let root = temp.path.join("sessions");
        let day = root.join("2025").join("12").join("03");
        for index in 0..8 {
            let file = day.join(format!(
                "rollout-2025-12-03T01-30-2{index}-session-{index}.jsonl"
            ));
            let event = format!(
                r#"{{"type":"session_meta","payload":{{"id":"session-{index}","cwd":"/tmp/{index}","timestamp":"2025-12-03T01:30:28.000Z"}}}}"#
            );
            write_rollout(file.as_path(), event.as_str());
        }

        let sessions = collect_local_cli_sessions(root.as_path(), 16, StdDuration::from_millis(0));
        assert!(sessions.is_empty());
    }
}
