use serde_json::Value;

use crate::{
    RuntimeProvider, DEFAULT_ANTHROPIC_MODEL_ID, DEFAULT_GEMINI_MODEL_ID, DEFAULT_OPENAI_MODEL_ID,
};

pub(crate) fn parse_runtime_provider(value: Option<&str>) -> Option<RuntimeProvider> {
    RuntimeProvider::from_alias(value)
}

pub(crate) fn infer_provider(
    provider_hint: Option<&str>,
    model_id: Option<&str>,
) -> RuntimeProvider {
    if let Some(provider) = parse_runtime_provider(provider_hint) {
        return provider;
    }

    if let Some(provider) = detect_provider_from_model_id(model_id) {
        return provider;
    }

    RuntimeProvider::OpenAI
}

pub(crate) fn detect_provider_from_model_id(model_id: Option<&str>) -> Option<RuntimeProvider> {
    let model = model_id
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_ascii_lowercase)?;
    let compact_model = model.replace('-', "").replace('_', "");
    if model.starts_with("anthropic/") || model.contains("claude") {
        return Some(RuntimeProvider::Anthropic);
    }
    if model.starts_with("google/")
        || model.starts_with("antigravity/")
        || model.starts_with("anti-gravity/")
        || model.contains("gemini")
        || model.contains("antigravity")
        || compact_model.contains("antigravity")
    {
        return Some(RuntimeProvider::Google);
    }
    if model.starts_with("openai/") || model.contains("gpt") || model.contains("codex") {
        return Some(RuntimeProvider::OpenAI);
    }
    None
}

#[derive(Debug, Default, Clone)]
pub(crate) struct CompatModelCatalog {
    openai_models: Vec<String>,
    anthropic_models: Vec<String>,
    google_models: Vec<String>,
}

impl CompatModelCatalog {
    pub(crate) fn has_provider_models(&self, provider: RuntimeProvider) -> bool {
        match provider {
            RuntimeProvider::OpenAI => !self.openai_models.is_empty(),
            RuntimeProvider::Anthropic => !self.anthropic_models.is_empty(),
            RuntimeProvider::ClaudeCodeLocal => false,
            RuntimeProvider::Google => !self.google_models.is_empty(),
        }
    }

    pub(crate) fn models_for_provider(&self, provider: RuntimeProvider) -> &[String] {
        match provider {
            RuntimeProvider::OpenAI => self.openai_models.as_slice(),
            RuntimeProvider::Anthropic => self.anthropic_models.as_slice(),
            RuntimeProvider::ClaudeCodeLocal => &[],
            RuntimeProvider::Google => self.google_models.as_slice(),
        }
    }

    pub(crate) fn preferred_default_for_provider(
        &self,
        provider: RuntimeProvider,
    ) -> Option<String> {
        let candidates = self.models_for_provider(provider);
        let mut best: Option<(&str, i32)> = None;

        for candidate in candidates {
            let model_id = candidate.trim();
            if model_id.is_empty() {
                continue;
            }

            let score = score_model_for_provider_default(provider, model_id);
            match best {
                Some((current_model, current_score)) => {
                    if score > current_score
                        || (score == current_score
                            && model_id.to_ascii_lowercase() < current_model.to_ascii_lowercase())
                    {
                        best = Some((model_id, score));
                    }
                }
                None => best = Some((model_id, score)),
            }
        }

        best.map(|(model_id, _)| model_id.to_string())
    }
}

pub(crate) fn parse_openai_compat_model_catalog(payload: &Value) -> CompatModelCatalog {
    let mut catalog = CompatModelCatalog::default();
    let mut seen = std::collections::HashSet::new();

    let entries = payload
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for entry in entries {
        let Some(model_id) = entry
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let canonical = model_id.to_string();
        if !seen.insert(canonical.clone()) {
            continue;
        }

        match detect_provider_from_model_id(Some(canonical.as_str())) {
            Some(RuntimeProvider::OpenAI) => catalog.openai_models.push(canonical),
            Some(RuntimeProvider::Anthropic) => catalog.anthropic_models.push(canonical),
            Some(RuntimeProvider::ClaudeCodeLocal) => {}
            Some(RuntimeProvider::Google) => catalog.google_models.push(canonical),
            None => {}
        }
    }

    catalog
}

fn score_model_for_provider_default(provider: RuntimeProvider, model_id: &str) -> i32 {
    let normalized = model_id.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return i32::MIN;
    }

    let mut score = 0;
    if normalized.contains("preview") {
        score -= 40;
    }
    if normalized.contains("exp") || normalized.contains("experimental") {
        score -= 220;
    }
    if normalized.contains("thinking") {
        score -= 35;
    }
    if normalized.contains("image")
        || normalized.contains("vision")
        || normalized.contains("audio")
        || normalized.contains("embedding")
        || normalized.contains("transcribe")
    {
        score -= 200;
    }
    if normalized.contains("-low") || normalized.contains("-mini") || normalized.contains("lite") {
        score -= 10;
    }

    match provider {
        RuntimeProvider::OpenAI => {
            if normalized == DEFAULT_OPENAI_MODEL_ID {
                score += 650;
            } else if normalized.contains("codex") {
                score += 620;
            } else if normalized.contains("gpt-5") {
                score += 580;
            } else if normalized.contains("o4") {
                score += 540;
            } else if normalized.contains("gpt-4.1") {
                score += 520;
            } else if normalized.contains("gpt-4o") {
                score += 500;
            } else if normalized.contains("gpt-4") {
                score += 420;
            } else if normalized.contains("gpt-3.5") {
                score += 260;
            }
        }
        RuntimeProvider::Anthropic => {
            if normalized == DEFAULT_ANTHROPIC_MODEL_ID {
                score += 680;
            } else if normalized.contains("claude-sonnet-4-5") {
                score += 660;
            } else if normalized.contains("claude-opus-4-6") {
                score += 640;
            } else if normalized.contains("claude-opus") {
                score += 620;
            } else if normalized.contains("claude-sonnet") {
                score += 580;
            } else if normalized.contains("claude-3-5-sonnet") {
                score += 540;
            } else if normalized.contains("claude-haiku") || normalized.contains("claude-3-haiku") {
                score += 420;
            }
        }
        RuntimeProvider::ClaudeCodeLocal => {
            if normalized == DEFAULT_ANTHROPIC_MODEL_ID {
                score += 680;
            } else if normalized.contains("claude-sonnet-4-5") {
                score += 660;
            } else if normalized.contains("claude-opus-4-6") {
                score += 640;
            } else if normalized.contains("claude-opus") {
                score += 620;
            } else if normalized.contains("claude-sonnet") {
                score += 580;
            } else if normalized.contains("claude-haiku") || normalized.contains("claude-3-haiku") {
                score += 420;
            }
        }
        RuntimeProvider::Google => {
            if normalized == DEFAULT_GEMINI_MODEL_ID {
                score += 680;
            } else if normalized.contains("gemini-3.1-pro") {
                score += 670;
            } else if normalized.contains("gemini-3-pro") {
                score += 660;
            } else if normalized.contains("gemini-2.5-pro") {
                score += 650;
            } else if normalized.contains("gemini-3-flash") {
                score += 620;
            } else if normalized.contains("gemini-2.5-flash") {
                score += 600;
            } else if normalized.contains("gemini-3") {
                score += 560;
            } else if normalized.contains("gemini-2.5") {
                score += 520;
            } else if normalized.contains("gemini-2.0-flash") {
                score += 420;
            } else if normalized.contains("gemini") {
                score += 320;
            }
        }
    }

    score
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_runtime_provider_accepts_antigravity_as_google_alias() {
        assert_eq!(
            parse_runtime_provider(Some("antigravity")),
            Some(RuntimeProvider::Google)
        );
        assert_eq!(
            parse_runtime_provider(Some("anti-gravity")),
            Some(RuntimeProvider::Google)
        );
        assert_eq!(
            parse_runtime_provider(Some("Gemini")),
            Some(RuntimeProvider::Google)
        );
        assert_eq!(
            parse_runtime_provider(Some("google")),
            Some(RuntimeProvider::Google)
        );
    }

    #[test]
    fn detect_provider_from_model_id_accepts_antigravity_model_prefix() {
        assert_eq!(
            detect_provider_from_model_id(Some("antigravity/gemini-3.1-pro")),
            Some(RuntimeProvider::Google)
        );
        assert_eq!(
            detect_provider_from_model_id(Some("anti-gravity/gemini-3.1-pro")),
            Some(RuntimeProvider::Google)
        );
    }
}
