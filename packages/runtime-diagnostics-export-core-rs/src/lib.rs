use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fmt::Write as _;
use std::io::{Cursor, Write as _};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

const RUNTIME_DIAGNOSTICS_EXPORT_FILENAME_PREFIX: &str = "runtime-diagnostics";
const REDACTED_VALUE: &str = "[REDACTED]";
const HASH_HEX_CHARS: usize = 12;
const DEFAULT_ZIP_FILE_PERMISSIONS: u32 = 0o644;
const MAX_RUNTIME_DIAGNOSTICS_EXPORT_ZIP_BYTES: usize = 4 * 1024 * 1024;
const SENSITIVE_KEY_MARKERS: &[&str] = &[
    "token",
    "secret",
    "api_key",
    "apikey",
    "password",
    "authorization",
    "cookie",
];

pub const RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION: &str = "runtime-diagnostics-export/v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RuntimeDiagnosticsRedactionLevel {
    Strict,
    Balanced,
    Minimal,
}

impl RuntimeDiagnosticsRedactionLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Strict => "strict",
            Self::Balanced => "balanced",
            Self::Minimal => "minimal",
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiagnosticsRedactionStats {
    pub redacted_keys: u64,
    pub redacted_values: u64,
    pub hashed_paths: u64,
    pub hashed_emails: u64,
    pub hashed_secrets: u64,
}

#[derive(Clone, Debug)]
pub struct RuntimeDiagnosticsSection {
    pub path: String,
    pub payload: Value,
}

#[derive(Clone, Debug)]
pub struct RuntimeDiagnosticsExportBuildInput {
    pub exported_at: u64,
    pub source: &'static str,
    pub redaction_level: RuntimeDiagnosticsRedactionLevel,
    pub sections: Vec<RuntimeDiagnosticsSection>,
    pub warnings: Vec<String>,
    pub include_zip_base64: bool,
}

#[derive(Clone, Debug)]
pub struct RuntimeDiagnosticsExportBuildOutput {
    pub filename: String,
    pub size_bytes: u64,
    pub zip_base64: Option<String>,
    pub sections: Vec<String>,
    pub warnings: Vec<String>,
    pub redaction_stats: RuntimeDiagnosticsRedactionStats,
}

pub fn parse_runtime_diagnostics_redaction_level(
    raw: Option<&str>,
) -> Result<RuntimeDiagnosticsRedactionLevel, String> {
    let normalized = raw
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("strict")
        .to_ascii_lowercase();
    match normalized.as_str() {
        "strict" => Ok(RuntimeDiagnosticsRedactionLevel::Strict),
        "balanced" => Ok(RuntimeDiagnosticsRedactionLevel::Balanced),
        "minimal" => Ok(RuntimeDiagnosticsRedactionLevel::Minimal),
        _ => {
            Err("Unsupported `redactionLevel`; expected strict, balanced, or minimal.".to_string())
        }
    }
}

pub fn build_runtime_diagnostics_export(
    input: RuntimeDiagnosticsExportBuildInput,
) -> Result<RuntimeDiagnosticsExportBuildOutput, String> {
    build_runtime_diagnostics_export_with_max_bytes(input, MAX_RUNTIME_DIAGNOSTICS_EXPORT_ZIP_BYTES)
}

fn build_runtime_diagnostics_export_with_max_bytes(
    mut input: RuntimeDiagnosticsExportBuildInput,
    max_zip_bytes: usize,
) -> Result<RuntimeDiagnosticsExportBuildOutput, String> {
    let mut redaction_stats = RuntimeDiagnosticsRedactionStats::default();
    let mut redacted_sections: Vec<(String, Value)> = Vec::new();
    let mut unique_paths = HashSet::new();

    for section in input.sections.drain(..) {
        let normalized_path = normalize_section_path(section.path.as_str());
        if normalized_path.is_empty() {
            push_unique_warning(
                &mut input.warnings,
                "Skipped a diagnostics section with an empty path.",
            );
            continue;
        }
        if !unique_paths.insert(normalized_path.clone()) {
            push_unique_warning(
                &mut input.warnings,
                format!("Skipped duplicated diagnostics section path `{normalized_path}`."),
            );
            continue;
        }
        let redacted_payload = redact_value(
            section.payload,
            input.redaction_level,
            &mut redaction_stats,
            None,
        );
        redacted_sections.push((normalized_path, redacted_payload));
    }

    if redacted_sections.is_empty() {
        push_unique_warning(
            &mut input.warnings,
            "No diagnostics sections were exported after preprocessing.",
        );
    }

    let section_paths = redacted_sections
        .iter()
        .map(|(path, _)| path.clone())
        .collect::<Vec<_>>();
    let response_sections = std::iter::once("manifest.json".to_string())
        .chain(section_paths.clone())
        .collect::<Vec<_>>();
    let manifest = json!({
        "schemaVersion": RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION,
        "exportedAt": input.exported_at,
        "source": input.source,
        "redactionLevel": input.redaction_level.as_str(),
        "sections": section_paths,
        "warnings": input.warnings,
        "redactionStats": redaction_stats,
    });

    let (size_bytes, zip_base64) = if input.include_zip_base64 {
        let zip_bytes = build_zip_payload(
            std::iter::once(("manifest.json".to_string(), manifest))
                .chain(redacted_sections.into_iter())
                .collect::<Vec<_>>(),
        )?;
        if zip_bytes.len() > max_zip_bytes {
            return Err(format!(
                "diagnostics export payload exceeds zip size limit: {} > {} bytes",
                zip_bytes.len(),
                max_zip_bytes
            ));
        }
        (
            zip_bytes.len() as u64,
            Some(STANDARD.encode(zip_bytes.as_slice())),
        )
    } else {
        push_unique_warning(
            &mut input.warnings,
            "Skipped zip payload generation because includeZipBase64=false; `sizeBytes` is 0.",
        );
        (0, None)
    };
    let filename = format!(
        "{RUNTIME_DIAGNOSTICS_EXPORT_FILENAME_PREFIX}-{}.zip",
        input.exported_at
    );

    Ok(RuntimeDiagnosticsExportBuildOutput {
        filename,
        size_bytes,
        zip_base64,
        sections: response_sections,
        warnings: input.warnings,
        redaction_stats,
    })
}

fn build_zip_payload(entries: Vec<(String, Value)>) -> Result<Vec<u8>, String> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::<u8>::new()));
    for (path, payload) in entries {
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(DEFAULT_ZIP_FILE_PERMISSIONS);
        writer.start_file(path.as_str(), options).map_err(|error| {
            format!("failed to start diagnostics zip file entry `{path}`: {error}")
        })?;
        let serialized = serde_json::to_vec(&payload)
            .map_err(|error| format!("failed to serialize JSON: {error}"))?;
        writer
            .write_all(serialized.as_slice())
            .map_err(|error| format!("failed to write diagnostics zip: {error}"))?;
        writer
            .write_all(b"\n")
            .map_err(|error| format!("failed to write diagnostics zip: {error}"))?;
    }
    let cursor = writer
        .finish()
        .map_err(|error| format!("failed to finalize diagnostics zip: {error}"))?;
    Ok(cursor.into_inner())
}

fn redact_value(
    value: Value,
    level: RuntimeDiagnosticsRedactionLevel,
    stats: &mut RuntimeDiagnosticsRedactionStats,
    parent_key: Option<&str>,
) -> Value {
    match value {
        Value::Object(map) => {
            let mut redacted = serde_json::Map::with_capacity(map.len());
            for (key, nested_value) in map {
                if should_redact_sensitive_key(key.as_str(), parent_key) {
                    stats.redacted_keys = stats.redacted_keys.saturating_add(1);
                    redacted.insert(key, Value::String(REDACTED_VALUE.to_string()));
                    continue;
                }
                redacted.insert(
                    key.clone(),
                    redact_value(nested_value, level, stats, Some(key.as_str())),
                );
            }
            Value::Object(redacted)
        }
        Value::Array(values) => Value::Array(
            values
                .into_iter()
                .map(|entry| redact_value(entry, level, stats, parent_key))
                .collect(),
        ),
        Value::String(raw) => redact_string_value(raw, level, stats),
        other => other,
    }
}

fn redact_string_value(
    raw: String,
    level: RuntimeDiagnosticsRedactionLevel,
    stats: &mut RuntimeDiagnosticsRedactionStats,
) -> Value {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Value::String(raw);
    }

    if matches!(
        level,
        RuntimeDiagnosticsRedactionLevel::Strict | RuntimeDiagnosticsRedactionLevel::Balanced
    ) && looks_like_email(trimmed)
    {
        stats.redacted_values = stats.redacted_values.saturating_add(1);
        stats.hashed_emails = stats.hashed_emails.saturating_add(1);
        return Value::String(format!("<email:{}>", short_sha256_hex(trimmed)));
    }

    if looks_like_secret(trimmed) {
        stats.redacted_values = stats.redacted_values.saturating_add(1);
        stats.hashed_secrets = stats.hashed_secrets.saturating_add(1);
        return Value::String(format!("<secret:{}>", short_sha256_hex(trimmed)));
    }

    if matches!(level, RuntimeDiagnosticsRedactionLevel::Strict) && looks_like_path(trimmed) {
        stats.redacted_values = stats.redacted_values.saturating_add(1);
        stats.hashed_paths = stats.hashed_paths.saturating_add(1);
        return Value::String(format!("<path:{}>", short_sha256_hex(trimmed)));
    }

    Value::String(raw)
}

fn should_redact_sensitive_key(key: &str, parent_key: Option<&str>) -> bool {
    let normalized_key = key.trim().to_ascii_lowercase().replace('-', "_");
    if SENSITIVE_KEY_MARKERS
        .iter()
        .any(|marker| normalized_key.contains(marker))
    {
        return true;
    }
    let Some(parent_key) = parent_key else {
        return false;
    };
    let normalized_parent = parent_key.trim().to_ascii_lowercase().replace('-', "_");
    SENSITIVE_KEY_MARKERS
        .iter()
        .any(|marker| normalized_parent.contains(marker))
}

fn looks_like_email(value: &str) -> bool {
    if value.contains(char::is_whitespace) {
        return false;
    }
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    if local.is_empty() || domain.is_empty() {
        return false;
    }
    if domain.starts_with('.') || domain.ends_with('.') {
        return false;
    }
    domain.contains('.')
}

fn looks_like_path(value: &str) -> bool {
    if value.contains('\n') || value.contains('\r') {
        return false;
    }
    if value.starts_with("~/")
        || value.starts_with("./")
        || value.starts_with("../")
        || value.starts_with('/')
    {
        return true;
    }
    let bytes = value.as_bytes();
    if bytes.len() > 2
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
    {
        return true;
    }
    (value.contains('/') || value.contains('\\')) && !value.contains(char::is_whitespace)
}

fn looks_like_secret(value: &str) -> bool {
    if looks_like_jwt(value) {
        return true;
    }
    let lower = value.to_ascii_lowercase();
    if lower.starts_with("sk-")
        || lower.starts_with("ghp_")
        || lower.starts_with("gho_")
        || lower.starts_with("xoxb-")
    {
        return true;
    }
    if value.len() < 24 {
        return false;
    }
    let mut has_alpha = false;
    let mut has_digit = false;
    for ch in value.chars() {
        if ch.is_ascii_alphabetic() {
            has_alpha = true;
            continue;
        }
        if ch.is_ascii_digit() {
            has_digit = true;
            continue;
        }
        if !matches!(ch, '-' | '_' | '=' | '+' | '/' | '.') {
            return false;
        }
    }
    has_alpha && has_digit
}

fn looks_like_jwt(value: &str) -> bool {
    let mut parts = value.split('.');
    let (Some(first), Some(second), Some(third), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };
    [first, second, third].iter().all(|segment| {
        !segment.is_empty()
            && segment
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '='))
    })
}

fn short_sha256_hex(input: &str) -> String {
    let digest = Sha256::digest(input.as_bytes());
    let mut output = String::with_capacity(HASH_HEX_CHARS);
    for byte in digest
        .iter()
        .take(HASH_HEX_CHARS.checked_div(2).unwrap_or_default())
    {
        let _ = write!(&mut output, "{byte:02x}");
    }
    output
}

fn normalize_section_path(path: &str) -> String {
    path.trim().replace('\\', "/")
}

fn push_unique_warning(warnings: &mut Vec<String>, warning: impl Into<String>) {
    let warning = warning.into();
    if warning.trim().is_empty() || warnings.iter().any(|entry| entry == &warning) {
        return;
    }
    warnings.push(warning);
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose::STANDARD;
    use std::io::Read;
    use zip::ZipArchive;

    #[test]
    fn strict_redaction_masks_sensitive_keys_and_hashes_values() {
        let input = RuntimeDiagnosticsExportBuildInput {
            exported_at: 1_741_111_111_111,
            source: "runtime-service",
            redaction_level: RuntimeDiagnosticsRedactionLevel::Strict,
            sections: vec![RuntimeDiagnosticsSection {
                path: "runtime/runtime-diagnostics.json".to_string(),
                payload: json!({
                    "api_key": "secret-raw-value",
                    "nested": {
                        "authorization": "Bearer foo",
                        "email": "alice@example.com",
                        "path": "/Users/alice/.ssh/id_rsa",
                        "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl",
                    }
                }),
            }],
            warnings: Vec::new(),
            include_zip_base64: true,
        };

        let output = build_runtime_diagnostics_export(input).expect("build diagnostics zip");
        assert_eq!(output.redaction_stats.redacted_keys, 2);
        assert_eq!(output.redaction_stats.redacted_values, 3);
        assert_eq!(output.redaction_stats.hashed_emails, 1);
        assert_eq!(output.redaction_stats.hashed_paths, 1);
        assert_eq!(output.redaction_stats.hashed_secrets, 1);
    }

    #[test]
    fn diagnostics_export_zip_contains_manifest_and_sections() {
        let input = RuntimeDiagnosticsExportBuildInput {
            exported_at: 1_741_222_222_222,
            source: "runtime-service",
            redaction_level: RuntimeDiagnosticsRedactionLevel::Strict,
            sections: vec![
                RuntimeDiagnosticsSection {
                    path: "runtime/health.json".to_string(),
                    payload: json!({ "status": "ok" }),
                },
                RuntimeDiagnosticsSection {
                    path: "runtime/settings-summary.json".to_string(),
                    payload: json!({ "defaultAccessMode": "on-request" }),
                },
            ],
            warnings: Vec::new(),
            include_zip_base64: true,
        };
        let output = build_runtime_diagnostics_export(input).expect("build diagnostics zip");
        let zip_base64 = output.zip_base64.expect("zip base64 should be included");
        let decoded = STANDARD
            .decode(zip_base64.as_bytes())
            .expect("decode base64");
        let cursor = Cursor::new(decoded);
        let mut archive = ZipArchive::new(cursor).expect("open zip archive");
        let mut names = Vec::new();
        for index in 0..archive.len() {
            let file = archive.by_index(index).expect("read zip entry");
            names.push(file.name().to_string());
        }
        assert_eq!(
            names,
            vec![
                "manifest.json".to_string(),
                "runtime/health.json".to_string(),
                "runtime/settings-summary.json".to_string()
            ]
        );

        let mut manifest = archive.by_name("manifest.json").expect("open manifest");
        let mut manifest_text = String::new();
        manifest
            .read_to_string(&mut manifest_text)
            .expect("read manifest content");
        assert!(manifest_text.contains(RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION));
    }

    #[test]
    fn diagnostics_export_rejects_oversized_zip_payload() {
        let input = RuntimeDiagnosticsExportBuildInput {
            exported_at: 1_741_333_333_333,
            source: "runtime-service",
            redaction_level: RuntimeDiagnosticsRedactionLevel::Minimal,
            sections: vec![RuntimeDiagnosticsSection {
                path: "runtime/large.json".to_string(),
                payload: json!({
                    "large": "x".repeat(16 * 1024)
                }),
            }],
            warnings: Vec::new(),
            include_zip_base64: true,
        };

        let error = build_runtime_diagnostics_export_with_max_bytes(input, 256)
            .expect_err("expected oversize zip payload error");
        assert!(error.contains("zip size limit"));
    }

    #[test]
    fn diagnostics_export_can_skip_zip_base64_encoding() {
        let input = RuntimeDiagnosticsExportBuildInput {
            exported_at: 1_741_444_444_444,
            source: "runtime-service",
            redaction_level: RuntimeDiagnosticsRedactionLevel::Strict,
            sections: vec![RuntimeDiagnosticsSection {
                path: "runtime/health.json".to_string(),
                payload: json!({ "status": "ok" }),
            }],
            warnings: Vec::new(),
            include_zip_base64: false,
        };
        let output = build_runtime_diagnostics_export(input).expect("build diagnostics zip");
        assert_eq!(output.size_bytes, 0);
        assert_eq!(output.zip_base64, None);
        assert!(output
            .warnings
            .iter()
            .any(|entry| entry.contains("includeZipBase64=false")));
    }
}
