use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_PROVIDER_PRIORITIES: [(&str, i32); 3] =
    [("openai", 100), ("anthropic", 90), ("google", 80)];
const DEFAULT_PROVIDER_PRIORITY_POLICY: &str = "openai>anthropic>google";
const DEFAULT_PROVIDER_FAILURE_THRESHOLD: u32 = 2;
const DEFAULT_PROVIDER_COOLDOWN_SECONDS: u64 = 60;

#[derive(Clone, Debug)]
struct OAuthProviderState {
    priority: i32,
    cooldown_until: Option<u64>,
}

#[derive(Clone, Debug)]
pub struct OAuthAccountRegistry {
    providers: BTreeMap<String, OAuthProviderState>,
    provider_failure_threshold: u32,
    provider_cooldown_seconds: u64,
}

impl OAuthAccountRegistry {
    pub fn from_active_providers<I, S>(providers: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        let mut registry = Self {
            providers: BTreeMap::new(),
            provider_failure_threshold: DEFAULT_PROVIDER_FAILURE_THRESHOLD,
            provider_cooldown_seconds: DEFAULT_PROVIDER_COOLDOWN_SECONDS,
        };

        for provider in providers
            .into_iter()
            .map(|provider| provider.into())
            .filter_map(|provider| normalize_provider_name(provider.as_str()))
        {
            let priority = default_priority_for_provider(&provider);
            registry.providers.insert(
                provider,
                OAuthProviderState {
                    priority,
                    cooldown_until: None,
                },
            );
        }

        registry
    }

    pub fn seeded() -> Self {
        Self::from_active_providers(["openai", "anthropic", "google"])
    }

    pub fn from_env() -> Self {
        let mut registry = match std::env::var("CODE_TAURI_OAUTH_ACTIVE") {
            Ok(active) => {
                let active_providers: Vec<_> = active
                    .split(',')
                    .map(str::trim)
                    .filter(|part| !part.is_empty())
                    .map(|provider| provider.to_ascii_lowercase())
                    .collect();
                if active_providers.is_empty() {
                    Self::seeded()
                } else {
                    Self::from_active_providers(active_providers)
                }
            }
            Err(_) => Self::seeded(),
        };

        if let Ok(disabled) = std::env::var("CODE_TAURI_OAUTH_DISABLED") {
            for provider in disabled
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
            {
                if let Some(normalized_provider) = normalize_provider_name(provider) {
                    registry.providers.remove(&normalized_provider);
                }
            }
        }

        let policy = std::env::var("CODE_TAURI_OAUTH_PRIORITY_POLICY")
            .unwrap_or_else(|_| DEFAULT_PROVIDER_PRIORITY_POLICY.to_string());
        registry.apply_priority_policy(&policy);

        if let Ok(priorities) = std::env::var("CODE_TAURI_OAUTH_PRIORITY") {
            for entry in priorities
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
            {
                let mut segments = entry.splitn(2, '=');
                let provider = segments
                    .next()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .and_then(normalize_provider_name);
                let priority = segments
                    .next()
                    .map(str::trim)
                    .and_then(|value| value.parse::<i32>().ok());
                let (Some(provider), Some(priority)) = (provider, priority) else {
                    continue;
                };
                if let Some(state) = registry.providers.get_mut(&provider) {
                    state.priority = priority;
                }
            }
        }

        if let Ok(cooldowns) = std::env::var("CODE_TAURI_OAUTH_COOLDOWN") {
            for entry in cooldowns
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
            {
                let mut segments = entry.splitn(2, '=');
                let provider = segments
                    .next()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .and_then(normalize_provider_name);
                let cooldown = segments
                    .next()
                    .map(str::trim)
                    .and_then(parse_cooldown_until);
                let (Some(provider), Some(cooldown_until)) = (provider, cooldown) else {
                    continue;
                };
                if let Some(state) = registry.providers.get_mut(&provider) {
                    state.cooldown_until = Some(cooldown_until);
                }
            }
        }

        registry.provider_failure_threshold =
            std::env::var("CODE_TAURI_PROVIDER_FAILURE_THRESHOLD")
                .ok()
                .and_then(|value| value.parse::<u32>().ok())
                .filter(|value| *value > 0)
                .unwrap_or(DEFAULT_PROVIDER_FAILURE_THRESHOLD);
        registry.provider_cooldown_seconds = std::env::var("CODE_TAURI_PROVIDER_COOLDOWN_SECONDS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(DEFAULT_PROVIDER_COOLDOWN_SECONDS);

        registry
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn has_active_provider(&self, provider: &str) -> bool {
        normalize_provider_name(provider)
            .map(|normalized_provider| self.providers.contains_key(&normalized_provider))
            .unwrap_or(false)
    }

    pub fn provider_priority(&self, provider: &str) -> i32 {
        let Some(normalized_provider) = normalize_provider_name(provider) else {
            return 0;
        };
        self.providers
            .get(&normalized_provider)
            .map(|state| state.priority)
            .unwrap_or_default()
    }

    pub fn is_provider_routable(&self, provider: &str) -> bool {
        let Some(normalized_provider) = normalize_provider_name(provider) else {
            return false;
        };
        let Some(state) = self.providers.get(&normalized_provider) else {
            return false;
        };
        !is_in_cooldown(state.cooldown_until)
    }

    #[cfg(test)]
    pub fn with_provider_cooldown(mut self, provider: &str, cooldown_until: u64) -> Self {
        if let Some(normalized_provider) = normalize_provider_name(provider) {
            if let Some(state) = self.providers.get_mut(&normalized_provider) {
                state.cooldown_until = Some(cooldown_until);
            }
        }
        self
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn with_provider_priority(mut self, provider: &str, priority: i32) -> Self {
        if let Some(normalized_provider) = normalize_provider_name(provider) {
            if let Some(state) = self.providers.get_mut(&normalized_provider) {
                state.priority = priority;
            }
        }
        self
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn with_provider_failure_policy(
        mut self,
        failure_threshold: u32,
        cooldown_seconds: u64,
    ) -> Self {
        self.provider_failure_threshold = failure_threshold.max(1);
        self.provider_cooldown_seconds = cooldown_seconds;
        self
    }

    pub fn provider_failure_threshold(&self) -> u32 {
        self.provider_failure_threshold
    }

    pub fn provider_cooldown_seconds(&self) -> u64 {
        self.provider_cooldown_seconds
    }

    fn apply_priority_policy(&mut self, raw_policy: &str) {
        let providers = parse_provider_policy(raw_policy);
        if providers.is_empty() {
            return;
        }

        let top_priority = i32::MAX / 4;
        for (index, provider) in providers.iter().enumerate() {
            if let Some(state) = self.providers.get_mut(provider) {
                state.priority = top_priority - (index as i32);
            }
        }
    }
}

fn normalize_provider_name(raw_provider: &str) -> Option<String> {
    let normalized = raw_provider.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }

    let canonical = match normalized.as_str() {
        "openai" | "codex" | "openai-codex" => "openai",
        "anthropic" | "claude" | "claude_code" | "claude-code" => "anthropic",
        "google" | "gemini" | "antigravity" | "anti-gravity" | "gemini-antigravity" => "google",
        _ => normalized.as_str(),
    };
    Some(canonical.to_string())
}

fn unix_timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn parse_cooldown_until(raw: &str) -> Option<u64> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }

    if let Some(seconds) = value
        .strip_prefix('+')
        .and_then(|part| part.parse::<u64>().ok())
    {
        return Some(unix_timestamp_seconds().saturating_add(seconds));
    }

    value.parse::<u64>().ok()
}

fn is_in_cooldown(cooldown_until: Option<u64>) -> bool {
    cooldown_until
        .map(|until| until > unix_timestamp_seconds())
        .unwrap_or(false)
}

fn default_priority_for_provider(provider: &str) -> i32 {
    let Some(normalized_provider) = normalize_provider_name(provider) else {
        return 50;
    };
    DEFAULT_PROVIDER_PRIORITIES
        .iter()
        .find_map(|(name, priority)| (*name == normalized_provider).then_some(*priority))
        .unwrap_or(50)
}

fn parse_provider_policy(raw_policy: &str) -> Vec<String> {
    raw_policy
        .split(['>', ','])
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .filter_map(normalize_provider_name)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::OAuthAccountRegistry;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unix_timestamp_seconds() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0)
    }

    #[test]
    fn seeded_registry_contains_oauth_fallback_providers() {
        let registry = OAuthAccountRegistry::seeded();

        assert!(registry.has_active_provider("openai"));
        assert!(registry.has_active_provider("anthropic"));
        assert!(registry.has_active_provider("google"));
        assert!(registry.has_active_provider("gemini"));
        assert!(registry.has_active_provider("antigravity"));
        assert!(registry.has_active_provider("anti-gravity"));
    }

    #[test]
    fn custom_registry_only_contains_explicit_providers() {
        let registry = OAuthAccountRegistry::from_active_providers(["anthropic"]);

        assert!(registry.has_active_provider("anthropic"));
        assert!(!registry.has_active_provider("google"));
    }

    #[test]
    fn alias_provider_names_are_canonicalized_to_google_group() {
        let registry =
            OAuthAccountRegistry::from_active_providers(["gemini", "antigravity", "anti-gravity"]);

        assert!(registry.has_active_provider("google"));
        assert!(registry.has_active_provider("gemini"));
        assert!(registry.has_active_provider("antigravity"));
        assert!(registry.has_active_provider("anti-gravity"));
        assert_eq!(
            registry.provider_priority("google"),
            registry.provider_priority("gemini")
        );
        assert_eq!(
            registry.provider_priority("google"),
            registry.provider_priority("antigravity")
        );
        assert_eq!(
            registry.provider_priority("google"),
            registry.provider_priority("anti-gravity")
        );
    }

    #[test]
    fn provider_priority_defaults_to_expected_values() {
        let registry = OAuthAccountRegistry::seeded();

        assert!(registry.provider_priority("openai") > registry.provider_priority("google"));
        assert!(registry.provider_priority("anthropic") > registry.provider_priority("google"));
    }

    #[test]
    fn provider_in_cooldown_is_not_routable_until_expiry() {
        let now = unix_timestamp_seconds();
        let registry = OAuthAccountRegistry::from_active_providers(["openai"])
            .with_provider_cooldown("openai", now + 120);

        assert!(registry.has_active_provider("openai"));
        assert!(!registry.is_provider_routable("openai"));
    }

    #[test]
    fn provider_with_expired_cooldown_is_routable() {
        let now = unix_timestamp_seconds();
        let registry = OAuthAccountRegistry::from_active_providers(["openai"])
            .with_provider_cooldown("openai", now.saturating_sub(1));

        assert!(registry.is_provider_routable("openai"));
    }

    #[test]
    fn provider_failure_policy_can_be_configured() {
        let registry = OAuthAccountRegistry::seeded().with_provider_failure_policy(1, 120);

        assert_eq!(registry.provider_failure_threshold(), 1);
        assert_eq!(registry.provider_cooldown_seconds(), 120);
    }

    #[test]
    fn provider_priority_override_applies_to_known_provider() {
        let registry = OAuthAccountRegistry::seeded().with_provider_priority("google", 200);

        assert_eq!(registry.provider_priority("google"), 200);
    }
}
