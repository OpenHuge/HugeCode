use crate::backend::runtime_backend;
use code_runtime_service_rs::{
    compute_instruction_skill_shared_fingerprint, compute_instruction_skill_workspace_fingerprint,
    resolve_instruction_skill_watch_roots,
};
use notify::{recommended_watcher, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const RUNTIME_EVENT_NAME: &str = "fastcode://runtime/event";
const SKILLS_UPDATE_METHOD: &str = "native_state_fabric_updated";
const SKILLS_WATCH_DEBOUNCE: Duration = Duration::from_millis(350);
const SKILLS_WATCH_TICK_INTERVAL: Duration = Duration::from_millis(250);
const SKILLS_WORKSPACE_REFRESH_INTERVAL: Duration = Duration::from_secs(2);
const SKILLS_FALLBACK_POLL_INTERVAL: Duration = Duration::from_secs(2);

static INSTRUCTION_SKILLS_WATCHER: OnceLock<()> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Eq)]
enum WatchScope {
    Workspace(String),
    Global,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct DesiredWatchRoot {
    scope: WatchScope,
    root_path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct WatchRegistration {
    scope: WatchScope,
    root_path: PathBuf,
    watch_path: PathBuf,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum InstructionSkillsWatcherMode {
    Watch,
    PollFallback,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionSkillsWatcherStatus {
    mode: InstructionSkillsWatcherMode,
    watched_root_count: usize,
    workspace_count: usize,
    debounce_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    fallback_reason: Option<String>,
}

impl InstructionSkillsWatcherStatus {
    fn watch(watched_root_count: usize, workspace_count: usize) -> Self {
        Self {
            mode: InstructionSkillsWatcherMode::Watch,
            watched_root_count,
            workspace_count,
            debounce_ms: duration_to_ms(SKILLS_WATCH_DEBOUNCE),
            fallback_reason: None,
        }
    }

    fn poll_fallback(
        watched_root_count: usize,
        workspace_count: usize,
        fallback_reason: impl Into<String>,
    ) -> Self {
        Self {
            mode: InstructionSkillsWatcherMode::PollFallback,
            watched_root_count,
            workspace_count,
            debounce_ms: duration_to_ms(SKILLS_WATCH_DEBOUNCE),
            fallback_reason: Some(fallback_reason.into()),
        }
    }
}

#[derive(Debug)]
struct InstructionSkillsWatcherState {
    workspace_paths: HashMap<String, PathBuf>,
    desired_roots: Vec<DesiredWatchRoot>,
    registrations: Vec<WatchRegistration>,
    watched_paths: HashSet<PathBuf>,
    workspace_fingerprints: HashMap<String, String>,
    shared_fingerprint: Option<String>,
    mode: InstructionSkillsWatcherMode,
    fallback_reason: Option<String>,
    pending_event_paths: Vec<PathBuf>,
    debounce_deadline: Option<Instant>,
    last_workspace_refresh: Instant,
    last_fallback_poll: Instant,
}

impl InstructionSkillsWatcherState {
    fn new() -> Self {
        let workspace_paths = collect_workspace_paths();
        let desired_roots = build_desired_watch_roots(&workspace_paths);
        let mut state = Self {
            workspace_paths,
            desired_roots,
            registrations: Vec::new(),
            watched_paths: HashSet::new(),
            workspace_fingerprints: HashMap::new(),
            shared_fingerprint: None,
            mode: InstructionSkillsWatcherMode::Watch,
            fallback_reason: None,
            pending_event_paths: Vec::new(),
            debounce_deadline: None,
            last_workspace_refresh: Instant::now(),
            last_fallback_poll: Instant::now(),
        };
        state.seed_fingerprints();
        state
    }

    fn status(&self) -> InstructionSkillsWatcherStatus {
        match self.mode {
            InstructionSkillsWatcherMode::Watch => InstructionSkillsWatcherStatus::watch(
                self.desired_roots.len(),
                self.workspace_paths.len(),
            ),
            InstructionSkillsWatcherMode::PollFallback => {
                InstructionSkillsWatcherStatus::poll_fallback(
                    self.desired_roots.len(),
                    self.workspace_paths.len(),
                    self.fallback_reason
                        .clone()
                        .unwrap_or_else(|| "watcher unavailable".to_string()),
                )
            }
        }
    }

    fn seed_fingerprints(&mut self) {
        self.workspace_fingerprints = self
            .workspace_paths
            .iter()
            .map(|(workspace_id, workspace_root)| {
                (
                    workspace_id.clone(),
                    compute_instruction_skill_workspace_fingerprint(Some(workspace_root.clone())),
                )
            })
            .collect();
        self.shared_fingerprint = if self.workspace_paths.is_empty() {
            None
        } else {
            Some(compute_instruction_skill_shared_fingerprint())
        };
    }

    fn switch_to_fallback(&mut self, fallback_reason: impl Into<String>) {
        self.mode = InstructionSkillsWatcherMode::PollFallback;
        self.fallback_reason = Some(fallback_reason.into());
        self.pending_event_paths.clear();
        self.debounce_deadline = None;
        self.last_fallback_poll = Instant::now();
    }
}

fn watcher_status_cell() -> &'static Mutex<InstructionSkillsWatcherStatus> {
    static STATUS: OnceLock<Mutex<InstructionSkillsWatcherStatus>> = OnceLock::new();
    STATUS.get_or_init(|| Mutex::new(snapshot_status_from_backend()))
}

pub fn attach_instruction_skills_refresh_relay(app: AppHandle) {
    if INSTRUCTION_SKILLS_WATCHER.set(()).is_err() {
        return;
    }
    thread::spawn(move || run_instruction_skills_watcher(app));
}

pub fn instruction_skills_watcher_diagnostics_payload() -> Value {
    let status = watcher_status_cell()
        .lock()
        .expect("instruction skills watcher status lock poisoned")
        .clone();
    serde_json::to_value(status).unwrap_or_else(|_| {
        json!({
            "mode": "poll-fallback",
            "watchedRootCount": 0,
            "workspaceCount": 0,
            "debounceMs": duration_to_ms(SKILLS_WATCH_DEBOUNCE),
            "fallbackReason": "serialize instruction skills watcher diagnostics failed",
        })
    })
}

fn run_instruction_skills_watcher(app: AppHandle) {
    let mut state = InstructionSkillsWatcherState::new();
    publish_status(&state.status());

    let (event_tx, event_rx) = mpsc::channel();
    let watcher_init = init_notify_watcher(event_tx);
    let mut watcher = match watcher_init {
        Ok(watcher) => Some(watcher),
        Err(error) => {
            state.switch_to_fallback(error);
            publish_status(&state.status());
            None
        }
    };

    if let Some(active_watcher) = watcher.as_mut() {
        if let Err(error) = rebuild_watch_registrations(active_watcher, &mut state) {
            state.switch_to_fallback(error);
            watcher = None;
            publish_status(&state.status());
        } else {
            publish_status(&state.status());
        }
    }

    loop {
        let wait_result = if watcher.is_some() {
            event_rx.recv_timeout(SKILLS_WATCH_TICK_INTERVAL)
        } else {
            thread::sleep(SKILLS_WATCH_TICK_INTERVAL);
            Err(mpsc::RecvTimeoutError::Timeout)
        };

        match wait_result {
            Ok(Ok(event)) => {
                record_event_paths(&mut state, &event);
            }
            Ok(Err(error)) => {
                state.switch_to_fallback(format!("notify event error: {error}"));
                watcher = None;
                publish_status(&state.status());
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                state.switch_to_fallback("notify channel disconnected");
                watcher = None;
                publish_status(&state.status());
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        if state.last_workspace_refresh.elapsed() >= SKILLS_WORKSPACE_REFRESH_INTERVAL {
            sync_workspace_watch_state(&app, &mut state, watcher.as_mut());
            state.last_workspace_refresh = Instant::now();
        }

        if matches!(state.mode, InstructionSkillsWatcherMode::Watch)
            && state
                .debounce_deadline
                .is_some_and(|deadline| Instant::now() >= deadline)
        {
            flush_pending_events(&app, &mut state);
        }

        if matches!(state.mode, InstructionSkillsWatcherMode::PollFallback)
            && state.last_fallback_poll.elapsed() >= SKILLS_FALLBACK_POLL_INTERVAL
        {
            poll_fallback_fingerprints(&app, &mut state);
            state.last_fallback_poll = Instant::now();
        }
    }
}

fn init_notify_watcher(
    event_tx: mpsc::Sender<Result<Event, notify::Error>>,
) -> Result<RecommendedWatcher, String> {
    recommended_watcher(move |event| {
        let _ = event_tx.send(event);
    })
    .map_err(|error| format!("failed to initialize instruction skills watcher: {error}"))
}

fn sync_workspace_watch_state(
    app: &AppHandle,
    state: &mut InstructionSkillsWatcherState,
    watcher: Option<&mut RecommendedWatcher>,
) {
    let next_workspace_paths = collect_workspace_paths();
    let next_desired_roots = build_desired_watch_roots(&next_workspace_paths);
    let workspace_ids = next_workspace_paths.keys().cloned().collect::<HashSet<_>>();

    state
        .workspace_fingerprints
        .retain(|workspace_id, _| workspace_ids.contains(workspace_id));

    let mut changed_workspace_ids = BTreeSet::new();
    for (workspace_id, workspace_root) in next_workspace_paths.iter() {
        let next_fingerprint =
            compute_instruction_skill_workspace_fingerprint(Some(workspace_root.clone()));
        match state.workspace_fingerprints.get(workspace_id) {
            Some(previous) if previous == &next_fingerprint => {}
            Some(_) => {
                changed_workspace_ids.insert(workspace_id.clone());
            }
            None => {}
        }
        state
            .workspace_fingerprints
            .insert(workspace_id.clone(), next_fingerprint);
    }

    let next_shared_fingerprint = if next_workspace_paths.is_empty() {
        None
    } else {
        Some(compute_instruction_skill_shared_fingerprint())
    };
    let shared_changed = state.shared_fingerprint != next_shared_fingerprint;
    state.shared_fingerprint = next_shared_fingerprint;
    state.workspace_paths = next_workspace_paths;

    if state.desired_roots != next_desired_roots {
        state.desired_roots = next_desired_roots;
        if let Some(active_watcher) = watcher {
            if let Err(error) = rebuild_watch_registrations(active_watcher, state) {
                state.switch_to_fallback(error);
            }
        }
    }

    publish_status(&state.status());
    if matches!(state.mode, InstructionSkillsWatcherMode::PollFallback) {
        return;
    }
    if shared_changed {
        for workspace_id in workspace_sorted_ids(&state.workspace_paths) {
            emit_skills_update_event(app, workspace_id.as_str());
        }
        return;
    }
    for workspace_id in changed_workspace_ids {
        emit_skills_update_event(app, workspace_id.as_str());
    }
}

fn poll_fallback_fingerprints(app: &AppHandle, state: &mut InstructionSkillsWatcherState) {
    let next_workspace_paths = collect_workspace_paths();
    let next_workspace_fingerprints = next_workspace_paths
        .iter()
        .map(|(workspace_id, workspace_root)| {
            (
                workspace_id.clone(),
                compute_instruction_skill_workspace_fingerprint(Some(workspace_root.clone())),
            )
        })
        .collect::<HashMap<_, _>>();
    let next_shared_fingerprint = if next_workspace_paths.is_empty() {
        None
    } else {
        Some(compute_instruction_skill_shared_fingerprint())
    };
    let refresh_decision = reconcile_instruction_skill_fingerprints(
        &mut state.workspace_fingerprints,
        &mut state.shared_fingerprint,
        next_workspace_fingerprints,
        next_shared_fingerprint,
    );
    state.workspace_paths = next_workspace_paths;
    state.desired_roots = build_desired_watch_roots(&state.workspace_paths);
    publish_status(&state.status());

    for workspace_id in refresh_decision.changed_workspace_ids {
        emit_skills_update_event(app, workspace_id.as_str());
    }
}

fn rebuild_watch_registrations(
    watcher: &mut RecommendedWatcher,
    state: &mut InstructionSkillsWatcherState,
) -> Result<(), String> {
    let next_registrations = state
        .desired_roots
        .iter()
        .filter_map(|root| {
            nearest_existing_watch_path(root.root_path.as_path()).map(|watch_path| {
                WatchRegistration {
                    scope: root.scope.clone(),
                    root_path: root.root_path.clone(),
                    watch_path,
                }
            })
        })
        .collect::<Vec<_>>();
    let next_watched_paths = next_registrations
        .iter()
        .map(|registration| registration.watch_path.clone())
        .collect::<HashSet<_>>();

    for removed in state.watched_paths.difference(&next_watched_paths) {
        let _ = watcher.unwatch(removed.as_path());
    }
    for added in next_watched_paths.difference(&state.watched_paths) {
        watcher
            .watch(added.as_path(), RecursiveMode::Recursive)
            .map_err(|error| format!("failed to watch {}: {error}", added.display()))?;
    }

    state.registrations = next_registrations;
    state.watched_paths = next_watched_paths;
    Ok(())
}

fn flush_pending_events(app: &AppHandle, state: &mut InstructionSkillsWatcherState) {
    let event_paths = std::mem::take(&mut state.pending_event_paths);
    state.debounce_deadline = None;
    let impact = classify_event_impact(&state.registrations, &event_paths);
    if !impact.shared_dirty && impact.workspace_ids.is_empty() {
        return;
    }

    let mut changed_workspace_ids = BTreeSet::new();
    if impact.shared_dirty {
        let next_shared_fingerprint = if state.workspace_paths.is_empty() {
            None
        } else {
            Some(compute_instruction_skill_shared_fingerprint())
        };
        if state.shared_fingerprint != next_shared_fingerprint {
            state.shared_fingerprint = next_shared_fingerprint;
            for workspace_id in workspace_sorted_ids(&state.workspace_paths) {
                changed_workspace_ids.insert(workspace_id);
            }
        }
    }

    for workspace_id in impact.workspace_ids {
        let Some(workspace_root) = state.workspace_paths.get(workspace_id.as_str()) else {
            continue;
        };
        let next_fingerprint =
            compute_instruction_skill_workspace_fingerprint(Some(workspace_root.clone()));
        match state.workspace_fingerprints.get(workspace_id.as_str()) {
            Some(previous) if previous == &next_fingerprint => {}
            Some(_) => {
                changed_workspace_ids.insert(workspace_id.clone());
            }
            None => {}
        }
        state
            .workspace_fingerprints
            .insert(workspace_id, next_fingerprint);
    }

    for workspace_id in changed_workspace_ids {
        emit_skills_update_event(app, workspace_id.as_str());
    }
}

#[derive(Debug, PartialEq, Eq)]
struct EventImpact {
    shared_dirty: bool,
    workspace_ids: BTreeSet<String>,
}

fn classify_event_impact(
    registrations: &[WatchRegistration],
    event_paths: &[PathBuf],
) -> EventImpact {
    let mut impact = EventImpact {
        shared_dirty: false,
        workspace_ids: BTreeSet::new(),
    };
    for event_path in event_paths {
        for registration in registrations {
            if !watch_root_matches_event(registration.root_path.as_path(), event_path.as_path()) {
                continue;
            }
            match &registration.scope {
                WatchScope::Workspace(workspace_id) => {
                    impact.workspace_ids.insert(workspace_id.clone());
                }
                WatchScope::Global => {
                    impact.shared_dirty = true;
                }
            }
        }
    }
    impact
}

fn watch_root_matches_event(root_path: &Path, event_path: &Path) -> bool {
    event_path.starts_with(root_path) || root_path.starts_with(event_path)
}

fn record_event_paths(state: &mut InstructionSkillsWatcherState, event: &Event) {
    for path in event.paths.iter() {
        state.pending_event_paths.push(path.clone());
    }
    if !event.paths.is_empty() {
        state.debounce_deadline = Some(Instant::now() + SKILLS_WATCH_DEBOUNCE);
    }
}

fn nearest_existing_watch_path(root_path: &Path) -> Option<PathBuf> {
    let mut current = Some(root_path);
    while let Some(candidate) = current {
        if candidate.is_dir() {
            return Some(candidate.to_path_buf());
        }
        current = candidate.parent();
    }
    None
}

fn collect_workspace_paths() -> HashMap<String, PathBuf> {
    runtime_backend()
        .workspaces()
        .into_iter()
        .map(|workspace| (workspace.id, PathBuf::from(workspace.path)))
        .collect()
}

fn build_desired_watch_roots(workspace_paths: &HashMap<String, PathBuf>) -> Vec<DesiredWatchRoot> {
    let mut desired_roots = Vec::new();
    for workspace_id in workspace_sorted_ids(workspace_paths) {
        let Some(workspace_root) = workspace_paths.get(workspace_id.as_str()) else {
            continue;
        };
        desired_roots.extend(
            resolve_instruction_skill_watch_roots(Some(workspace_root.clone()))
                .into_iter()
                .filter(|root| root.scope == "workspace")
                .map(|root| DesiredWatchRoot {
                    scope: WatchScope::Workspace(workspace_id.clone()),
                    root_path: root.root_path,
                }),
        );
    }
    let mut seen_shared_roots = HashSet::new();
    for root in resolve_instruction_skill_watch_roots(None)
        .into_iter()
        .filter(|root| root.scope == "global")
    {
        if seen_shared_roots.insert(root.root_path.clone()) {
            desired_roots.push(DesiredWatchRoot {
                scope: WatchScope::Global,
                root_path: root.root_path,
            });
        }
    }
    desired_roots.sort_by(|left, right| left.root_path.cmp(&right.root_path));
    desired_roots
}

fn workspace_sorted_ids(workspace_paths: &HashMap<String, PathBuf>) -> Vec<String> {
    let mut workspace_ids = workspace_paths.keys().cloned().collect::<Vec<_>>();
    workspace_ids.sort();
    workspace_ids
}

fn publish_status(status: &InstructionSkillsWatcherStatus) {
    let mut current = watcher_status_cell()
        .lock()
        .expect("instruction skills watcher status lock poisoned while publishing");
    *current = status.clone();
}

fn snapshot_status_from_backend() -> InstructionSkillsWatcherStatus {
    let workspace_paths = collect_workspace_paths();
    let desired_roots = build_desired_watch_roots(&workspace_paths);
    InstructionSkillsWatcherStatus::watch(desired_roots.len(), workspace_paths.len())
}

fn emit_skills_update_event(app: &AppHandle, workspace_id: &str) {
    let revision = runtime_backend().append_state_fabric_change(
        crate::backend::NativeStateFabricChange::SkillsCatalogPatched {
            workspace_id: Some(workspace_id.to_string()),
        },
    );
    let payload = json!({
        "workspace_id": workspace_id,
        "message": {
            "method": SKILLS_UPDATE_METHOD,
            "params": {
                "revision": revision,
                "scopeKind": "skills",
                "workspaceId": workspace_id,
                "changeKind": "skillsCatalogPatched",
                "source": "instruction_skills_watcher",
            },
        },
    });
    let _ = app.emit(RUNTIME_EVENT_NAME, payload);
}

fn duration_to_ms(duration: Duration) -> u64 {
    duration.as_millis().try_into().unwrap_or(u64::MAX)
}

#[derive(Debug, PartialEq, Eq)]
struct SkillsRefreshDecision {
    shared_changed: bool,
    changed_workspace_ids: Vec<String>,
}

fn reconcile_instruction_skill_fingerprints(
    previous_workspace_fingerprints: &mut HashMap<String, String>,
    previous_shared_fingerprint: &mut Option<String>,
    next_workspace_fingerprints: HashMap<String, String>,
    next_shared_fingerprint: Option<String>,
) -> SkillsRefreshDecision {
    let shared_changed = match (
        previous_shared_fingerprint.as_deref(),
        next_shared_fingerprint.as_deref(),
    ) {
        (Some(previous), Some(next)) => previous != next,
        _ => false,
    };
    *previous_shared_fingerprint = next_shared_fingerprint;

    let mut changed_workspace_ids = Vec::new();
    for (workspace_id, next_fingerprint) in next_workspace_fingerprints.iter() {
        let workspace_changed = previous_workspace_fingerprints
            .insert(workspace_id.clone(), next_fingerprint.clone())
            .as_deref()
            .is_some_and(|previous_value| previous_value != next_fingerprint);
        if shared_changed || workspace_changed {
            changed_workspace_ids.push(workspace_id.clone());
        }
    }
    previous_workspace_fingerprints
        .retain(|workspace_id, _| next_workspace_fingerprints.contains_key(workspace_id));
    changed_workspace_ids.sort();

    SkillsRefreshDecision {
        shared_changed,
        changed_workspace_ids,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_desired_watch_roots, classify_event_impact, nearest_existing_watch_path,
        watch_root_matches_event, EventImpact, InstructionSkillsWatcherMode,
        InstructionSkillsWatcherStatus, WatchRegistration, WatchScope,
    };
    use std::collections::{BTreeSet, HashMap};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn watch_root_matches_descendant_and_parent_events() {
        let root = PathBuf::from("/tmp/workspace/.agents/skills");
        assert!(watch_root_matches_event(
            root.as_path(),
            root.join("review").join("SKILL.md").as_path()
        ));
        assert!(watch_root_matches_event(
            root.as_path(),
            root.parent().expect("parent")
        ));
        assert!(!watch_root_matches_event(
            root.as_path(),
            PathBuf::from("/tmp/workspace/src/main.rs").as_path()
        ));
    }

    #[test]
    fn classify_event_impact_routes_workspace_and_global_events() {
        let registrations = vec![
            WatchRegistration {
                scope: WatchScope::Workspace("ws-1".to_string()),
                root_path: PathBuf::from("/tmp/workspace-a/.agents/skills"),
                watch_path: PathBuf::from("/tmp/workspace-a/.agents"),
            },
            WatchRegistration {
                scope: WatchScope::Global,
                root_path: PathBuf::from("/tmp/home/.agents/skills"),
                watch_path: PathBuf::from("/tmp/home/.agents"),
            },
        ];

        let impact = classify_event_impact(
            &registrations,
            &[
                PathBuf::from("/tmp/workspace-a/.agents/skills/review/SKILL.md"),
                PathBuf::from("/tmp/home/.agents/skills/global-review/SKILL.md"),
            ],
        );

        assert_eq!(
            impact,
            EventImpact {
                shared_dirty: true,
                workspace_ids: BTreeSet::from(["ws-1".to_string()]),
            }
        );
    }

    #[test]
    fn nearest_existing_watch_path_falls_back_to_existing_parent() {
        let root = std::env::temp_dir().join(format!(
            "instruction-skills-watch-parent-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        ));
        let parent = root.join("workspace").join(".agents");
        fs::create_dir_all(parent.as_path()).expect("parent dir");
        let watch_path =
            nearest_existing_watch_path(parent.join("skills").as_path()).expect("watch path");
        assert_eq!(watch_path, parent);
    }

    #[test]
    fn build_desired_watch_roots_dedupes_shared_roots() {
        let workspace_paths = HashMap::from([
            ("ws-1".to_string(), PathBuf::from("/tmp/workspace-a")),
            ("ws-2".to_string(), PathBuf::from("/tmp/workspace-b")),
        ]);
        let roots = build_desired_watch_roots(&workspace_paths);
        let shared_count = roots
            .iter()
            .filter(|root| matches!(root.scope, WatchScope::Global))
            .count();
        assert!(shared_count >= 2);
        assert_eq!(
            roots
                .iter()
                .filter(|root| {
                    matches!(root.scope, WatchScope::Global)
                        && root.root_path.ends_with(".agents/skills")
                })
                .count(),
            1
        );
    }

    #[test]
    fn watcher_status_serializes_watch_mode() {
        let status = InstructionSkillsWatcherStatus {
            mode: InstructionSkillsWatcherMode::Watch,
            watched_root_count: 5,
            workspace_count: 2,
            debounce_ms: 350,
            fallback_reason: None,
        };
        let value = serde_json::to_value(status).expect("serialize status");
        assert_eq!(
            value.get("mode").and_then(serde_json::Value::as_str),
            Some("watch")
        );
    }
}
