use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use serde::Deserialize;

use crate::{normalize_reason_effort, provider_requests, TurnProviderRoute};

const PROVIDER_REPLAY_FILE_ENV: &str = "CODE_RUNTIME_SERVICE_PROVIDER_REPLAY_FILE";
const PROVIDER_REPLAY_MAX_DELAY_MS_ENV: &str = "CODE_RUNTIME_SERVICE_PROVIDER_REPLAY_MAX_DELAY_MS";
const CODE_RUNTIME_DEFAULT_WORKSPACE_PATH_ENV: &str = "CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH";
const DEFAULT_PROVIDER_REPLAY_MAX_DELAY_MS: u64 = 150;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderReplayFixture {
    variants: Vec<ProviderReplayVariant>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderReplayVariant {
    variant_id: String,
    provider: Option<String>,
    model_id: String,
    reason_effort: Option<String>,
    #[serde(default)]
    workspace_effects: Option<ProviderReplayWorkspaceEffects>,
    turns: Vec<ProviderReplayTurn>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderReplayWorkspaceEffects {
    #[serde(default)]
    expected_writes: Vec<ProviderReplayExpectedWrite>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderReplayExpectedWrite {
    relative_path: String,
    must_contain: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderReplayTurn {
    user_prompt: String,
    #[serde(default)]
    output: Option<String>,
    #[serde(default)]
    delta_chunks: Vec<String>,
    #[serde(default)]
    chunk_delay_ms: Option<u64>,
    #[serde(default)]
    failure: Option<ProviderReplayTurnFailure>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderReplayTurnFailure {
    message: String,
}

fn resolve_provider_replay_file() -> Option<PathBuf> {
    let raw = std::env::var(PROVIDER_REPLAY_FILE_ENV).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if path.is_absolute() {
        return Some(path);
    }
    Some(std::env::current_dir().ok()?.join(path))
}

fn load_provider_replay_fixture(path: &Path) -> Result<ProviderReplayFixture, String> {
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Read provider replay fixture `{}`: {error}", path.display()))?;
    serde_json::from_str::<ProviderReplayFixture>(raw.as_str()).map_err(|error| {
        format!(
            "Parse provider replay fixture `{}`: {error}",
            path.display()
        )
    })
}

fn resolve_provider_replay_max_delay_ms() -> u64 {
    std::env::var(PROVIDER_REPLAY_MAX_DELAY_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| value.min(5_000))
        .unwrap_or(DEFAULT_PROVIDER_REPLAY_MAX_DELAY_MS)
}

fn resolve_replay_workspace_root(workspace_root_override: Option<&Path>) -> Option<PathBuf> {
    if let Some(workspace_root) = workspace_root_override {
        return Some(workspace_root.to_path_buf());
    }
    let raw = std::env::var(CODE_RUNTIME_DEFAULT_WORKSPACE_PATH_ENV).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if path.is_absolute() {
        return Some(path);
    }
    Some(std::env::current_dir().ok()?.join(path))
}

fn resolve_workspace_effect_path(
    workspace_root: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("Provider replay workspace effect is missing relativePath.".to_string());
    }
    let candidate = Path::new(trimmed);
    if candidate.is_absolute() {
        return Err(format!(
            "Provider replay workspace effect `{trimmed}` must be relative to the replay workspace."
        ));
    }

    let mut resolved = workspace_root.to_path_buf();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => resolved.push(part),
            _ => {
                return Err(format!(
                    "Provider replay workspace effect `{trimmed}` must stay within the replay workspace."
                ));
            }
        }
    }
    Ok(resolved)
}

fn apply_workspace_effects(
    variant: &ProviderReplayVariant,
    workspace_root_override: Option<&Path>,
) -> Result<(), String> {
    let Some(workspace_effects) = variant.workspace_effects.as_ref() else {
        return Ok(());
    };
    if workspace_effects.expected_writes.is_empty() {
        return Ok(());
    }
    let workspace_root =
        resolve_replay_workspace_root(workspace_root_override).ok_or_else(|| {
            "Provider replay workspace effects require CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH."
                .to_string()
        })?;

    for expected_write in workspace_effects.expected_writes.iter() {
        let target_path =
            resolve_workspace_effect_path(&workspace_root, expected_write.relative_path.as_str())?;
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Create provider replay workspace effect directory `{}`: {error}",
                    parent.display()
                )
            })?;
        }
        fs::write(&target_path, expected_write.must_contain.as_bytes()).map_err(|error| {
            format!(
                "Write provider replay workspace effect `{}`: {error}",
                target_path.display()
            )
        })?;
    }

    Ok(())
}

fn normalize_optional_effort(value: Option<&str>) -> Option<String> {
    let entry = value.map(str::trim).filter(|entry| !entry.is_empty())?;
    match normalize_reason_effort(Some(entry)) {
        Ok(normalized) => normalized.or_else(|| Some(entry.to_string())),
        Err(_) => Some(entry.to_string()),
    }
}

fn find_matching_turn<'a>(
    fixture: &'a ProviderReplayFixture,
    provider_route: &TurnProviderRoute,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
) -> Option<(&'a ProviderReplayVariant, &'a ProviderReplayTurn)> {
    let routed_provider = provider_route.routed_provider().trim().to_ascii_lowercase();
    let normalized_model_id = model_id.trim();
    let normalized_reason_effort = normalize_optional_effort(reason_effort);
    let trimmed_content = content.trim_end();

    fixture.variants.iter().find_map(|variant| {
        if variant.model_id.trim() != normalized_model_id {
            return None;
        }
        if let Some(provider) = variant
            .provider
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
        {
            if provider.to_ascii_lowercase() != routed_provider {
                return None;
            }
        }
        if normalize_optional_effort(variant.reason_effort.as_deref())
            != normalize_optional_effort(normalized_reason_effort.as_deref())
        {
            return None;
        }

        variant
            .turns
            .iter()
            .find(|turn| {
                let prompt = turn.user_prompt.trim();
                !prompt.is_empty() && trimmed_content.ends_with(prompt)
            })
            .map(|turn| (variant, turn))
    })
}

async fn replay_matching_turn(
    path: &Path,
    fixture: &ProviderReplayFixture,
    provider_route: &TurnProviderRoute,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
    max_delay_ms: u64,
) -> Result<String, String> {
    let Some((variant, turn)) =
        find_matching_turn(fixture, provider_route, content, model_id, reason_effort)
    else {
        return Err(format!(
            "Provider replay fixture `{}` has no matching turn for provider=`{}`, model=`{}`, effort=`{}`.",
            path.display(),
            provider_route.routed_provider(),
            model_id,
            reason_effort.unwrap_or("none"),
        ));
    };

    if let Some(failure) = turn.failure.as_ref() {
        return Err(failure.message.trim().to_string());
    }

    let output = turn.output.as_deref().ok_or_else(|| {
        format!(
            "Provider replay fixture `{}` matched turn `{}` but has no output.",
            path.display(),
            turn.user_prompt
        )
    })?;

    if let Some(callback) = delta_callback {
        let chunks = if turn.delta_chunks.is_empty() {
            vec![output.to_string()]
        } else {
            turn.delta_chunks.clone()
        };
        let delay_ms = turn.chunk_delay_ms.unwrap_or_default().min(max_delay_ms);
        for chunk in chunks {
            callback(chunk);
            if delay_ms > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }
        }
    }

    apply_workspace_effects(variant, None)?;

    tracing::info!(
        replay_variant_id = variant.variant_id.as_str(),
        replay_model_id = variant.model_id.as_str(),
        replay_effort = variant.reason_effort.as_deref().unwrap_or("none"),
        "provider replay fixture satisfied runtime turn"
    );

    Ok(output.to_string())
}

pub(crate) async fn maybe_replay_provider_response(
    replay_path_override: Option<&Path>,
    provider_route: &TurnProviderRoute,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
) -> Result<Option<String>, String> {
    let replay_path = replay_path_override
        .map(PathBuf::from)
        .or_else(resolve_provider_replay_file);
    let Some(path) = replay_path.as_deref() else {
        return Ok(None);
    };
    let fixture = load_provider_replay_fixture(path)?;

    replay_matching_turn(
        path,
        &fixture,
        provider_route,
        content,
        model_id,
        reason_effort,
        delta_callback,
        resolve_provider_replay_max_delay_ms(),
    )
    .await
    .map(Some)
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::{RuntimeProvider, TurnProviderRoute};

    fn write_fixture_file(body: &str) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().expect("create replay fixture temp file");
        fs::write(file.path(), body).expect("write replay fixture temp file");
        file
    }

    #[tokio::test]
    async fn replays_matching_variant_and_streams_recorded_chunks() {
        let file = write_fixture_file(
            r#"{
              "variants": [
                {
                  "variantId": "gpt-5.4-low",
                  "provider": "openai",
                  "modelId": "gpt-5.4",
                  "reasonEffort": "low",
                  "turns": [
                    {
                      "userPrompt": "Respond with EXACT_TEST_LOW",
                      "output": "EXACT_TEST_LOW",
                      "deltaChunks": ["EXACT_", "TEST_", "LOW"],
                      "chunkDelayMs": 0
                    }
                  ]
                }
              ]
            }"#,
        );
        let seen_chunks: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let callback_chunks = seen_chunks.clone();
        let callback = Arc::new(move |delta: String| {
            callback_chunks
                .lock()
                .expect("lock replay chunk capture")
                .push(delta);
        }) as provider_requests::ProviderDeltaCallback;

        let fixture = load_provider_replay_fixture(file.path()).expect("load replay fixture");
        let output = replay_matching_turn(
            file.path(),
            &fixture,
            &TurnProviderRoute::Core(RuntimeProvider::OpenAI),
            "context prefix\n\nRespond with EXACT_TEST_LOW",
            "gpt-5.4",
            Some("low"),
            Some(callback),
            0,
        )
        .await
        .expect("replay result");

        assert_eq!(output, "EXACT_TEST_LOW");
        assert_eq!(
            seen_chunks
                .lock()
                .expect("lock replay chunk capture")
                .clone(),
            vec!["EXACT_".to_string(), "TEST_".to_string(), "LOW".to_string()]
        );
    }

    #[tokio::test]
    async fn returns_clear_error_when_replay_fixture_is_enabled_but_missing_turn() {
        let file = write_fixture_file(
            r#"{
              "variants": [
                {
                  "variantId": "gpt-5.4-high",
                  "provider": "openai",
                  "modelId": "gpt-5.4",
                  "reasonEffort": "high",
                  "turns": [
                    {
                      "userPrompt": "Respond with EXACT_TEST_HIGH",
                      "output": "EXACT_TEST_HIGH"
                    }
                  ]
                }
              ]
            }"#,
        );
        let fixture = load_provider_replay_fixture(file.path()).expect("load replay fixture");
        let error = replay_matching_turn(
            file.path(),
            &fixture,
            &TurnProviderRoute::Core(RuntimeProvider::OpenAI),
            "Respond with unmatched content",
            "gpt-5.4",
            Some("high"),
            None,
            0,
        )
        .await
        .expect_err("expected replay mismatch error");

        assert!(error.contains("no matching turn"));
    }

    #[tokio::test]
    async fn replays_recorded_failure_message_for_failed_turns() {
        let file = write_fixture_file(
            r#"{
              "variants": [
                {
                  "variantId": "gpt-5.4-low-recovery",
                  "provider": "openai",
                  "modelId": "gpt-5.4",
                  "reasonEffort": "low",
                  "turns": [
                    {
                      "userPrompt": "Respond with EXACT_TEST_FAILURE",
                      "failure": {
                        "message": "OPENAI_API_KEY is not configured for code-runtime-service-rs."
                      }
                    }
                  ]
                }
              ]
            }"#,
        );
        let fixture = load_provider_replay_fixture(file.path()).expect("load replay fixture");
        let error = replay_matching_turn(
            file.path(),
            &fixture,
            &TurnProviderRoute::Core(RuntimeProvider::OpenAI),
            "Respond with EXACT_TEST_FAILURE",
            "gpt-5.4",
            Some("low"),
            None,
            0,
        )
        .await
        .expect_err("expected replay failure");

        assert_eq!(
            error,
            "OPENAI_API_KEY is not configured for code-runtime-service-rs."
        );
    }

    #[test]
    fn applies_workspace_effects_for_write_safe_variants() {
        let file = write_fixture_file(
            r#"{
              "variants": [
                {
                  "variantId": "gpt-5.4-low-write-safe",
                  "provider": "openai",
                  "modelId": "gpt-5.4",
                  "reasonEffort": "low",
                  "workspaceEffects": {
                    "expectedWrites": [
                      {
                        "relativePath": "runtime-replay-write-safe/write-safe-minimal.txt",
                        "mustContain": "WRITE_SAFE_CONTENT: runtime replay dataset"
                      }
                    ]
                  },
                  "turns": [
                    {
                      "userPrompt": "Write the deterministic file",
                      "output": "WRITE_SAFE_DONE"
                    }
                  ]
                }
              ]
            }"#,
        );
        let fixture = load_provider_replay_fixture(file.path()).expect("load replay fixture");
        let variant = fixture
            .variants
            .first()
            .expect("expected replay fixture variant");
        let workspace = tempfile::tempdir().expect("create workspace tempdir");

        apply_workspace_effects(variant, Some(workspace.path())).expect("apply workspace effects");

        let output_path = workspace
            .path()
            .join("runtime-replay-write-safe")
            .join("write-safe-minimal.txt");
        let contents = fs::read_to_string(&output_path).expect("read workspace effect output");
        assert_eq!(contents, "WRITE_SAFE_CONTENT: runtime replay dataset");
    }

    #[test]
    fn rejects_workspace_effect_paths_that_escape_the_workspace_root() {
        let variant = ProviderReplayVariant {
            variant_id: "gpt-5.4-low-write-safe".to_string(),
            provider: Some("openai".to_string()),
            model_id: "gpt-5.4".to_string(),
            reason_effort: Some("low".to_string()),
            workspace_effects: Some(ProviderReplayWorkspaceEffects {
                expected_writes: vec![ProviderReplayExpectedWrite {
                    relative_path: "../outside.txt".to_string(),
                    must_contain: "blocked".to_string(),
                }],
            }),
            turns: vec![ProviderReplayTurn {
                user_prompt: "Write the deterministic file".to_string(),
                output: Some("WRITE_SAFE_DONE".to_string()),
                delta_chunks: Vec::new(),
                chunk_delay_ms: None,
                failure: None,
            }],
        };
        let workspace = tempfile::tempdir().expect("create workspace tempdir");

        let error =
            apply_workspace_effects(&variant, Some(workspace.path())).expect_err("expected error");

        assert!(error.contains("must stay within the replay workspace"));
    }
}
