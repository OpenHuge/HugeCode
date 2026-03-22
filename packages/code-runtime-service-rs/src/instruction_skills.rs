use super::*;
use crate::local_codex_cli_sessions::resolve_local_codex_home_dir;

const SKILL_FILE_NAME: &str = "SKILL.md";
const MAX_SUPPORTING_FILE_BYTES: u64 = 256 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiscoveredInstructionSkillSummary {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) scope: String,
    pub(crate) source_family: String,
    pub(crate) entry_path: String,
    pub(crate) source_root: String,
    pub(crate) enabled: bool,
    pub(crate) aliases: Vec<String>,
    pub(crate) shadowed_by: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResolvedInstructionSkillFile {
    pub(crate) path: String,
    pub(crate) content: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResolvedInstructionSkill {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) scope: String,
    pub(crate) source_family: String,
    pub(crate) source_root: String,
    pub(crate) entry_path: String,
    pub(crate) enabled: bool,
    pub(crate) aliases: Vec<String>,
    pub(crate) shadowed_by: Option<String>,
    pub(crate) frontmatter: Value,
    pub(crate) body: String,
    pub(crate) supporting_files: Vec<ResolvedInstructionSkillFile>,
}

#[derive(Clone, Debug)]
pub(crate) struct InstructionSkillRoots {
    pub(crate) workspace_root: Option<PathBuf>,
    pub(crate) home_agents_root: Option<PathBuf>,
    pub(crate) home_codex_root: Option<PathBuf>,
    pub(crate) bundled_root: Option<PathBuf>,
}

#[derive(Clone, Debug)]
struct SkillDiscoveryRoot {
    scope: &'static str,
    source_family: &'static str,
    root_path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InstructionSkillWatchRoot {
    pub scope: String,
    pub source_family: String,
    pub root_path: PathBuf,
}

#[derive(Clone, Debug)]
struct SkillCandidate {
    id: String,
    slug: String,
    name: String,
    description: String,
    scope: &'static str,
    source_family: &'static str,
    entry_path: PathBuf,
    source_root: PathBuf,
    frontmatter: Value,
    body: String,
}

pub(crate) fn resolve_instruction_skill_roots(
    workspace_root: Option<PathBuf>,
) -> InstructionSkillRoots {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let home_agents_root = home
        .as_ref()
        .map(|value| value.join(".agents").join("skills"));
    let home_codex_root = resolve_local_codex_home_dir().map(|value| value.join("skills"));
    InstructionSkillRoots {
        workspace_root,
        home_agents_root,
        home_codex_root,
        bundled_root: resolve_bundled_skills_root(),
    }
}

pub fn compute_instruction_skill_roots_fingerprint(workspace_root: Option<PathBuf>) -> String {
    let workspace_fingerprint =
        compute_instruction_skill_workspace_fingerprint(workspace_root.clone());
    let shared_fingerprint = compute_instruction_skill_shared_fingerprint();
    combine_instruction_skill_fingerprints(
        workspace_fingerprint.as_str(),
        shared_fingerprint.as_str(),
    )
}

pub fn compute_instruction_skill_workspace_fingerprint(workspace_root: Option<PathBuf>) -> String {
    let roots = resolve_instruction_skill_roots(workspace_root);
    let discovery_roots = build_skill_discovery_roots(&roots);
    compute_skill_discovery_roots_fingerprint(
        discovery_roots
            .into_iter()
            .filter(|root| root.scope == "workspace")
            .collect(),
    )
}

pub fn compute_instruction_skill_shared_fingerprint() -> String {
    let roots = resolve_instruction_skill_roots(None);
    let discovery_roots = build_skill_discovery_roots(&roots);
    compute_skill_discovery_roots_fingerprint(
        discovery_roots
            .into_iter()
            .filter(|root| root.scope == "global")
            .collect(),
    )
}

pub fn resolve_instruction_skill_watch_roots(
    workspace_root: Option<PathBuf>,
) -> Vec<InstructionSkillWatchRoot> {
    build_skill_discovery_roots(&resolve_instruction_skill_roots(workspace_root))
        .into_iter()
        .map(|root| InstructionSkillWatchRoot {
            scope: root.scope.to_string(),
            source_family: root.source_family.to_string(),
            root_path: root.root_path,
        })
        .collect()
}

fn combine_instruction_skill_fingerprints(workspace: &str, shared: &str) -> String {
    let mut hasher = DefaultHasher::new();
    workspace.hash(&mut hasher);
    shared.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn compute_skill_discovery_roots_fingerprint(discovery_roots: Vec<SkillDiscoveryRoot>) -> String {
    let mut hasher = DefaultHasher::new();
    for root in discovery_roots {
        root.scope.hash(&mut hasher);
        root.source_family.hash(&mut hasher);
        normalize_path(root.root_path.as_path()).hash(&mut hasher);
        hash_skill_root(root.root_path.as_path(), &mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

pub(crate) fn list_instruction_skill_summaries(
    roots: &InstructionSkillRoots,
    overlays: &[Value],
) -> Vec<DiscoveredInstructionSkillSummary> {
    let discovered = discover_instruction_skill_candidates(roots);
    build_skill_summaries(discovered, overlays)
}

pub(crate) fn get_instruction_skill(
    roots: &InstructionSkillRoots,
    overlays: &[Value],
    requested_id: &str,
) -> Option<ResolvedInstructionSkill> {
    let discovered = discover_instruction_skill_candidates(roots);
    let summaries = build_skill_summaries(discovered.clone(), overlays);
    let requested = requested_id.trim();
    if requested.is_empty() {
        return None;
    }

    let mut overall_winners = HashMap::<String, String>::new();
    let mut family_winners = HashMap::<(String, String), String>::new();
    for summary in summaries.iter() {
        let slug = summary
            .id
            .rsplit('.')
            .next()
            .unwrap_or_default()
            .to_string();
        overall_winners
            .entry(slug.clone())
            .or_insert_with(|| summary.id.clone());
        family_winners
            .entry((summary.source_family.clone(), slug))
            .or_insert_with(|| summary.id.clone());
    }

    let resolved_id = if summaries.iter().any(|entry| entry.id == requested) {
        Some(requested.to_string())
    } else if let Some((family, slug)) = requested.split_once(':') {
        family_winners
            .get(&(family.trim().to_string(), slug.trim().to_string()))
            .cloned()
    } else {
        overall_winners.get(requested).cloned()
    }?;

    let candidate = discovered
        .into_iter()
        .find(|entry| entry.id == resolved_id)?;
    let summary = summaries
        .into_iter()
        .find(|entry| entry.id == resolved_id)?;
    Some(ResolvedInstructionSkill {
        id: summary.id,
        name: summary.name,
        description: summary.description,
        scope: summary.scope,
        source_family: summary.source_family,
        source_root: summary.source_root,
        entry_path: summary.entry_path,
        enabled: summary.enabled,
        aliases: summary.aliases,
        shadowed_by: summary.shadowed_by,
        frontmatter: candidate.frontmatter,
        body: candidate.body,
        supporting_files: collect_supporting_files(candidate.entry_path.parent()?),
    })
}

fn resolve_bundled_skills_root() -> Option<PathBuf> {
    let current_dir_candidate = std::env::current_dir()
        .ok()
        .map(|value| value.join("packages").join("skills").join("bundled"))
        .filter(|value| value.is_dir());
    if current_dir_candidate.is_some() {
        return current_dir_candidate;
    }
    let manifest_candidate = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("skills")
        .join("bundled");
    if manifest_candidate.is_dir() {
        return Some(manifest_candidate);
    }
    None
}

fn build_skill_discovery_roots(roots: &InstructionSkillRoots) -> Vec<SkillDiscoveryRoot> {
    let mut discovery_roots = Vec::new();
    if let Some(workspace_root) = roots.workspace_root.as_ref() {
        discovery_roots.push(SkillDiscoveryRoot {
            scope: "workspace",
            source_family: "agents",
            root_path: workspace_root.join(".agents").join("skills"),
        });
        discovery_roots.push(SkillDiscoveryRoot {
            scope: "workspace",
            source_family: "codex",
            root_path: workspace_root.join(".codex").join("skills"),
        });
    }
    if let Some(home_agents_root) = roots.home_agents_root.as_ref() {
        discovery_roots.push(SkillDiscoveryRoot {
            scope: "global",
            source_family: "agents",
            root_path: home_agents_root.clone(),
        });
    }
    if let Some(home_codex_root) = roots.home_codex_root.as_ref() {
        discovery_roots.push(SkillDiscoveryRoot {
            scope: "global",
            source_family: "codex",
            root_path: home_codex_root.clone(),
        });
    }
    if let Some(bundled_root) = roots.bundled_root.as_ref() {
        discovery_roots.push(SkillDiscoveryRoot {
            scope: "global",
            source_family: "bundled",
            root_path: bundled_root.clone(),
        });
    }
    discovery_roots
}

fn discover_instruction_skill_candidates(roots: &InstructionSkillRoots) -> Vec<SkillCandidate> {
    let discovery_roots = build_skill_discovery_roots(roots);
    let mut candidates = Vec::new();
    for root in discovery_roots {
        if !root.root_path.is_dir() {
            continue;
        }
        let Ok(entries) = fs::read_dir(root.root_path.as_path()) else {
            continue;
        };
        let mut child_dirs = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect::<Vec<_>>();
        child_dirs.sort();
        for skill_dir in child_dirs {
            let skill_file = skill_dir.join(SKILL_FILE_NAME);
            if !skill_file.is_file() {
                continue;
            }
            let Ok(content) = fs::read_to_string(skill_file.as_path()) else {
                continue;
            };
            let slug = skill_dir
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            let Some(slug) = slug else {
                continue;
            };
            let (frontmatter, body) = parse_skill_frontmatter(content.as_str());
            let name =
                read_frontmatter_string(&frontmatter, "name").unwrap_or_else(|| slug.clone());
            let description = read_frontmatter_string(&frontmatter, "description")
                .unwrap_or_else(|| derive_skill_description(body.as_str(), name.as_str()));
            let id = format!("{}.{}.{}", root.scope, root.source_family, slug);
            candidates.push(SkillCandidate {
                id,
                slug,
                name,
                description,
                scope: root.scope,
                source_family: root.source_family,
                entry_path: skill_file,
                source_root: root.root_path.clone(),
                frontmatter,
                body,
            });
        }
    }
    candidates.sort_by(|left, right| {
        let left_priority = skill_priority(left);
        let right_priority = skill_priority(right);
        left_priority
            .cmp(&right_priority)
            .then_with(|| left.slug.cmp(&right.slug))
            .then_with(|| left.id.cmp(&right.id))
    });
    candidates
}

fn hash_skill_root(root_path: &Path, hasher: &mut DefaultHasher) {
    let Ok(metadata) = fs::symlink_metadata(root_path) else {
        return;
    };
    hash_skill_metadata("", root_path, metadata, hasher);
}

fn hash_skill_metadata(
    relative_path: &str,
    path: &Path,
    metadata: fs::Metadata,
    hasher: &mut DefaultHasher,
) {
    relative_path.hash(hasher);
    metadata.file_type().is_dir().hash(hasher);
    metadata.file_type().is_file().hash(hasher);
    metadata.file_type().is_symlink().hash(hasher);
    metadata.len().hash(hasher);
    if let Ok(modified) = metadata.modified() {
        if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
            duration.as_secs().hash(hasher);
            duration.subsec_nanos().hash(hasher);
        }
    }
    if metadata.file_type().is_symlink() {
        return;
    }
    if metadata.is_dir() {
        let Ok(entries) = fs::read_dir(path) else {
            return;
        };
        let mut children = entries
            .flatten()
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        children.sort();
        for child in children {
            let Ok(child_metadata) = fs::symlink_metadata(child.as_path()) else {
                continue;
            };
            let child_name = child
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            let next_relative = if relative_path.is_empty() {
                child_name.to_string()
            } else {
                format!("{relative_path}/{child_name}")
            };
            hash_skill_metadata(
                next_relative.as_str(),
                child.as_path(),
                child_metadata,
                hasher,
            );
        }
        return;
    }
    if metadata.is_file() && metadata.len() <= MAX_SUPPORTING_FILE_BYTES {
        if let Ok(bytes) = fs::read(path) {
            bytes.hash(hasher);
        }
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn skill_priority(candidate: &SkillCandidate) -> (usize, &str, &str) {
    let scope_priority = match (candidate.scope, candidate.source_family) {
        ("workspace", "agents") => 0,
        ("workspace", "codex") => 1,
        ("global", "agents") => 2,
        ("global", "codex") => 3,
        _ => 4,
    };
    (
        scope_priority,
        candidate.source_family,
        candidate.slug.as_str(),
    )
}

fn build_skill_summaries(
    discovered: Vec<SkillCandidate>,
    overlays: &[Value],
) -> Vec<DiscoveredInstructionSkillSummary> {
    let overlay_map = overlays
        .iter()
        .filter_map(|value| {
            let object = value.as_object()?;
            let id = object.get("id")?.as_str()?.trim();
            if id.is_empty() {
                return None;
            }
            Some((id.to_string(), value.clone()))
        })
        .collect::<HashMap<_, _>>();

    let mut winner_by_slug = HashMap::<String, String>::new();
    let mut family_winner_by_slug = HashMap::<(String, String), String>::new();
    for entry in discovered.iter() {
        winner_by_slug
            .entry(entry.slug.clone())
            .or_insert_with(|| entry.id.clone());
        family_winner_by_slug
            .entry((entry.source_family.to_string(), entry.slug.clone()))
            .or_insert_with(|| entry.id.clone());
    }

    let mut summaries = discovered
        .iter()
        .map(|entry| {
            let overall_winner = winner_by_slug.get(&entry.slug).cloned();
            let family_winner = family_winner_by_slug
                .get(&(entry.source_family.to_string(), entry.slug.clone()))
                .cloned();
            let mut aliases = Vec::new();
            if family_winner.as_deref() == Some(entry.id.as_str()) {
                aliases.push(format!("{}:{}", entry.source_family, entry.slug));
            }
            if overall_winner.as_deref() == Some(entry.id.as_str()) {
                aliases.insert(0, entry.slug.clone());
            }
            let enabled = overlay_map
                .get(entry.id.as_str())
                .and_then(|value| value.get("enabled"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            DiscoveredInstructionSkillSummary {
                id: entry.id.clone(),
                name: entry.name.clone(),
                description: entry.description.clone(),
                scope: entry.scope.to_string(),
                source_family: entry.source_family.to_string(),
                entry_path: normalize_skill_path(entry.entry_path.as_path()),
                source_root: normalize_skill_path(entry.source_root.as_path()),
                enabled,
                aliases,
                shadowed_by: overall_winner.filter(|winner| winner != entry.id.as_str()),
            }
        })
        .collect::<Vec<_>>();

    let discovered_ids = summaries
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<HashSet<_>>();
    for overlay in overlays {
        let Some(object) = overlay.as_object() else {
            continue;
        };
        let Some(id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        if discovered_ids.contains(id) {
            continue;
        }
        let name = object
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(id)
            .to_string();
        let description = object
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let scope = object
            .get("scope")
            .and_then(Value::as_str)
            .unwrap_or("global")
            .to_string();
        let source_family = object
            .get("sourceFamily")
            .or_else(|| object.get("source_family"))
            .and_then(Value::as_str)
            .unwrap_or("native")
            .to_string();
        summaries.push(DiscoveredInstructionSkillSummary {
            id: id.to_string(),
            name,
            description,
            scope,
            source_family,
            entry_path: object
                .get("entryPath")
                .or_else(|| object.get("entry_path"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            source_root: object
                .get("sourceRoot")
                .or_else(|| object.get("source_root"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            enabled: object
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true),
            aliases: object
                .get("aliases")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
            shadowed_by: object
                .get("shadowedBy")
                .or_else(|| object.get("shadowed_by"))
                .and_then(Value::as_str)
                .map(ToString::to_string),
        });
    }

    summaries.sort_by(|left, right| left.id.cmp(&right.id));
    summaries
}

fn collect_supporting_files(skill_dir: &Path) -> Vec<ResolvedInstructionSkillFile> {
    let canonical_root = fs::canonicalize(skill_dir).unwrap_or_else(|_| skill_dir.to_path_buf());
    let mut files = Vec::new();
    collect_supporting_files_recursive(
        canonical_root.as_path(),
        canonical_root.as_path(),
        &mut files,
    );
    files.sort_by(|left, right| left.path.cmp(&right.path));
    files
}

fn collect_supporting_files_recursive(
    skill_root: &Path,
    current_dir: &Path,
    files: &mut Vec<ResolvedInstructionSkillFile>,
) {
    let Ok(entries) = fs::read_dir(current_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(canonical_path) = fs::canonicalize(path.as_path()) else {
            continue;
        };
        if !canonical_path.starts_with(skill_root) {
            continue;
        }
        if canonical_path.is_dir() {
            collect_supporting_files_recursive(skill_root, canonical_path.as_path(), files);
            continue;
        }
        if canonical_path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value == SKILL_FILE_NAME)
        {
            continue;
        }
        let Ok(metadata) = fs::metadata(canonical_path.as_path()) else {
            continue;
        };
        if metadata.len() > MAX_SUPPORTING_FILE_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(canonical_path.as_path()) else {
            continue;
        };
        let Ok(content) = String::from_utf8(bytes) else {
            continue;
        };
        let Ok(relative) = canonical_path.strip_prefix(skill_root) else {
            continue;
        };
        files.push(ResolvedInstructionSkillFile {
            path: normalize_skill_path(relative),
            content,
        });
    }
}

fn parse_skill_frontmatter(content: &str) -> (Value, String) {
    let normalized = content.replace("\r\n", "\n");
    let Some(rest) = normalized.strip_prefix("---\n") else {
        return (
            Value::Object(serde_json::Map::new()),
            normalized.trim().to_string(),
        );
    };
    let Some(frontmatter_end) = rest.find("\n---\n") else {
        return (
            Value::Object(serde_json::Map::new()),
            normalized.trim().to_string(),
        );
    };
    let frontmatter_block = &rest[..frontmatter_end];
    let body = rest[(frontmatter_end + "\n---\n".len())..]
        .trim()
        .to_string();
    let mut object = serde_json::Map::new();
    for line in frontmatter_block.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('-') {
            continue;
        }
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let parsed_value = value.trim().trim_matches('"').trim_matches('\'');
        if parsed_value.is_empty() {
            continue;
        }
        object.insert(
            key.trim().to_string(),
            Value::String(parsed_value.to_string()),
        );
    }
    (Value::Object(object), body)
}

fn read_frontmatter_string(frontmatter: &Value, key: &str) -> Option<String> {
    frontmatter
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn derive_skill_description(body: &str, name: &str) -> String {
    for paragraph in body.split("\n\n") {
        let normalized = paragraph
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .collect::<Vec<_>>()
            .join(" ");
        if !normalized.is_empty() {
            return normalized;
        }
    }
    name.to_string()
}

fn normalize_skill_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn instruction_skill_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn write_skill(root: &Path, family_root: &str, slug: &str, body: &str) {
        let skill_dir = root.join(family_root).join(slug);
        fs::create_dir_all(skill_dir.as_path()).expect("create skill dir");
        fs::write(skill_dir.join(SKILL_FILE_NAME), body).expect("write skill file");
    }

    #[test]
    fn instruction_skill_discovery_prefers_agents_over_codex_and_workspace_over_global() {
        let test_root = std::env::temp_dir().join(format!(
            "instruction-skill-precedence-{}",
            rand::random::<u64>()
        ));
        let workspace_root = test_root.join("workspace");
        let home_root = test_root.join("home");
        fs::create_dir_all(workspace_root.as_path()).expect("workspace dir");
        fs::create_dir_all(home_root.as_path()).expect("home dir");
        write_skill(
            workspace_root.as_path(),
            ".agents/skills",
            "review",
            "---\nname: review\ndescription: workspace agents\n---\n# Review\n\nWorkspace agents body",
        );
        write_skill(
            workspace_root.as_path(),
            ".codex/skills",
            "review",
            "---\nname: review\ndescription: workspace codex\n---\n# Review\n\nWorkspace codex body",
        );
        write_skill(
            home_root.as_path(),
            ".agents/skills",
            "review",
            "---\nname: review\ndescription: home agents\n---\n# Review\n\nHome agents body",
        );

        let roots = InstructionSkillRoots {
            workspace_root: Some(workspace_root.clone()),
            home_agents_root: Some(home_root.join(".agents").join("skills")),
            home_codex_root: Some(home_root.join(".codex").join("skills")),
            bundled_root: None,
        };

        let summaries = list_instruction_skill_summaries(&roots, &[]);
        let workspace_agents = summaries
            .iter()
            .find(|entry| entry.id == "workspace.agents.review")
            .expect("workspace agents summary");
        let workspace_codex = summaries
            .iter()
            .find(|entry| entry.id == "workspace.codex.review")
            .expect("workspace codex summary");
        let global_agents = summaries
            .iter()
            .find(|entry| entry.id == "global.agents.review")
            .expect("global agents summary");

        assert_eq!(workspace_agents.aliases, vec!["review", "agents:review"]);
        assert_eq!(workspace_agents.shadowed_by, None);
        assert_eq!(
            workspace_codex.shadowed_by,
            Some("workspace.agents.review".to_string())
        );
        assert_eq!(
            global_agents.shadowed_by,
            Some("workspace.agents.review".to_string())
        );
    }

    #[test]
    fn instruction_skill_get_returns_body_and_supporting_files() {
        let test_root = std::env::temp_dir().join(format!(
            "instruction-skill-resolve-{}",
            rand::random::<u64>()
        ));
        let workspace_root = test_root.join("workspace");
        let skill_dir = workspace_root.join(".agents").join("skills").join("review");
        fs::create_dir_all(skill_dir.as_path()).expect("skill dir");
        fs::write(
            skill_dir.join(SKILL_FILE_NAME),
            "---\nname: review\ndescription: review docs\n---\n# Review\n\nUse checklist",
        )
        .expect("skill file");
        fs::write(skill_dir.join("checklist.md"), "- item 1").expect("supporting file");

        let roots = InstructionSkillRoots {
            workspace_root: Some(workspace_root),
            home_agents_root: None,
            home_codex_root: None,
            bundled_root: None,
        };

        let resolved =
            get_instruction_skill(&roots, &[], "review").expect("resolved instruction skill");
        assert_eq!(resolved.id, "workspace.agents.review");
        assert_eq!(resolved.description, "review docs");
        assert_eq!(resolved.supporting_files.len(), 1);
        assert_eq!(resolved.supporting_files[0].path, "checklist.md");
        assert_eq!(resolved.supporting_files[0].content, "- item 1");
    }

    #[test]
    fn instruction_skill_fingerprint_changes_when_skill_content_changes() {
        let test_root = std::env::temp_dir().join(format!(
            "instruction-skill-fingerprint-{}",
            rand::random::<u64>()
        ));
        let workspace_root = test_root.join("workspace");
        let skill_dir = workspace_root.join(".agents").join("skills").join("review");
        fs::create_dir_all(skill_dir.as_path()).expect("skill dir");
        fs::write(
            skill_dir.join(SKILL_FILE_NAME),
            "---\nname: review\ndescription: alpha\n---\nalpha",
        )
        .expect("skill file");
        fs::write(skill_dir.join("notes.md"), "12345").expect("supporting file");

        let before = compute_instruction_skill_roots_fingerprint(Some(workspace_root.clone()));
        let workspace_before =
            compute_instruction_skill_workspace_fingerprint(Some(workspace_root.clone()));
        let shared_before = compute_instruction_skill_shared_fingerprint();

        fs::write(
            skill_dir.join(SKILL_FILE_NAME),
            "---\nname: review\ndescription: bravo\n---\nbravo",
        )
        .expect("updated skill file");
        fs::write(skill_dir.join("notes.md"), "67890").expect("updated supporting file");

        let after = compute_instruction_skill_roots_fingerprint(Some(workspace_root));
        let workspace_after =
            compute_instruction_skill_workspace_fingerprint(Some(test_root.join("workspace")));
        let shared_after = compute_instruction_skill_shared_fingerprint();
        assert_ne!(before, after);
        assert_ne!(workspace_before, workspace_after);
        assert_eq!(shared_before, shared_after);
    }

    #[test]
    fn instruction_skill_shared_fingerprint_changes_without_workspace_fingerprint_change() {
        let test_root = std::env::temp_dir().join(format!(
            "instruction-skill-shared-fingerprint-{}",
            rand::random::<u64>()
        ));
        let workspace_root = test_root.join("workspace");
        let home_root = test_root.join("home");
        fs::create_dir_all(workspace_root.as_path()).expect("workspace dir");
        fs::create_dir_all(home_root.as_path()).expect("home dir");
        write_skill(
            workspace_root.as_path(),
            ".agents/skills",
            "local-review",
            "---\nname: local-review\ndescription: local\n---\nlocal",
        );
        write_skill(
            home_root.as_path(),
            ".agents/skills",
            "global-review",
            "---\nname: global-review\ndescription: alpha\n---\nalpha",
        );

        let roots = InstructionSkillRoots {
            workspace_root: Some(workspace_root.clone()),
            home_agents_root: Some(home_root.join(".agents").join("skills")),
            home_codex_root: None,
            bundled_root: None,
        };
        let workspace_before = compute_skill_discovery_roots_fingerprint(
            build_skill_discovery_roots(&roots)
                .into_iter()
                .filter(|root| root.scope == "workspace")
                .collect(),
        );
        let shared_before = compute_skill_discovery_roots_fingerprint(
            build_skill_discovery_roots(&roots)
                .into_iter()
                .filter(|root| root.scope == "global")
                .collect(),
        );

        fs::write(
            home_root
                .join(".agents")
                .join("skills")
                .join("global-review")
                .join(SKILL_FILE_NAME),
            "---\nname: global-review\ndescription: bravo\n---\nbravo",
        )
        .expect("updated global skill");

        let workspace_after = compute_skill_discovery_roots_fingerprint(
            build_skill_discovery_roots(&roots)
                .into_iter()
                .filter(|root| root.scope == "workspace")
                .collect(),
        );
        let shared_after = compute_skill_discovery_roots_fingerprint(
            build_skill_discovery_roots(&roots)
                .into_iter()
                .filter(|root| root.scope == "global")
                .collect(),
        );

        assert_eq!(workspace_before, workspace_after);
        assert_ne!(shared_before, shared_after);
    }

    #[test]
    fn instruction_skill_watch_roots_include_workspace_and_global_sources() {
        let _guard = instruction_skill_env_lock()
            .lock()
            .expect("instruction skill env lock poisoned");
        let test_root = std::env::temp_dir().join(format!(
            "instruction-skill-watch-roots-{}",
            rand::random::<u64>()
        ));
        let workspace_root = test_root.join("workspace");
        let home_root = test_root.join("home");
        let previous_home = std::env::var_os("HOME");
        let previous_userprofile = std::env::var_os("USERPROFILE");
        let previous_runtime_local_codex_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        std::env::set_var("HOME", home_root.as_os_str());
        std::env::remove_var("USERPROFILE");
        std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME");
        std::env::remove_var("CODEX_HOME");

        let roots = resolve_instruction_skill_watch_roots(Some(workspace_root.clone()));
        let root_paths = roots
            .into_iter()
            .map(|root| (root.scope, root.source_family, root.root_path))
            .collect::<Vec<_>>();

        assert!(root_paths.contains(&(
            "workspace".to_string(),
            "agents".to_string(),
            workspace_root.join(".agents").join("skills"),
        )));
        assert!(root_paths.contains(&(
            "workspace".to_string(),
            "codex".to_string(),
            workspace_root.join(".codex").join("skills"),
        )));
        assert!(root_paths.contains(&(
            "global".to_string(),
            "agents".to_string(),
            home_root.join(".agents").join("skills"),
        )));
        assert!(root_paths.contains(&(
            "global".to_string(),
            "codex".to_string(),
            home_root.join(".codex").join("skills"),
        )));
        assert!(root_paths
            .iter()
            .any(|(scope, source_family, _)| scope == "global" && source_family == "bundled"));

        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_userprofile {
            Some(value) => std::env::set_var("USERPROFILE", value),
            None => std::env::remove_var("USERPROFILE"),
        }
        match previous_runtime_local_codex_home {
            Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
            None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
        }
        match previous_codex_home {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
    }
}
