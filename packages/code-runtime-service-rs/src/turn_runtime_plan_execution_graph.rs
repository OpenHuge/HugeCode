use super::ProviderRuntimeStep;
use crate::AgentStepKind;
use std::collections::{HashMap, HashSet};

pub(super) const PROVIDER_RUNTIME_PLAN_MAX_PARALLEL_WAVE_WIDTH: usize = 6;

#[derive(Debug, Clone)]
pub(super) struct ScheduledProviderRuntimeStep {
    pub(super) index: usize,
    pub(super) task_key: String,
    pub(super) depends_on: Vec<String>,
    pub(super) wave_index: usize,
    pub(super) step: ProviderRuntimeStep,
}

fn is_parallel_safe_step(step: &ProviderRuntimeStep) -> bool {
    matches!(step.kind, AgentStepKind::Read | AgentStepKind::Diagnostics)
        && !step.requires_approval.unwrap_or(false)
}

fn default_task_key(step: &ProviderRuntimeStep, index: usize) -> String {
    format!(
        "step-{}-{}",
        index + 1,
        step.kind.as_str().replace('_', "-")
    )
}

fn normalize_task_key(base: &str) -> String {
    let trimmed = base.trim().to_ascii_lowercase();
    let normalized = trimmed
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let collapsed = normalized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "step".to_string()
    } else {
        collapsed
    }
}

fn dedupe_dependency_keys(
    dependencies: &[String],
    task_key: &str,
    known_keys: &HashSet<String>,
) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    for dependency in dependencies {
        let normalized = dependency.trim();
        if normalized.is_empty() || normalized == task_key || !known_keys.contains(normalized) {
            continue;
        }
        if seen.insert(normalized.to_string()) {
            deduped.push(normalized.to_string());
        }
    }
    deduped
}

fn compute_wave_indexes(
    scheduled_steps: &[ScheduledProviderRuntimeStep],
) -> HashMap<String, usize> {
    let task_index_by_key = scheduled_steps
        .iter()
        .map(|step| (step.task_key.clone(), step.index))
        .collect::<HashMap<_, _>>();
    let mut dependents_by_key = HashMap::<String, Vec<String>>::new();
    let mut indegree_by_key = HashMap::<String, usize>::new();

    for step in scheduled_steps {
        dependents_by_key.entry(step.task_key.clone()).or_default();
        indegree_by_key.insert(step.task_key.clone(), step.depends_on.len());
    }
    for step in scheduled_steps {
        for dependency in &step.depends_on {
            dependents_by_key
                .entry(dependency.clone())
                .or_default()
                .push(step.task_key.clone());
        }
    }

    let mut ready = scheduled_steps
        .iter()
        .filter(|step| step.depends_on.is_empty())
        .map(|step| step.task_key.clone())
        .collect::<Vec<_>>();
    ready.sort_by_key(|task_key| task_index_by_key.get(task_key).copied().unwrap_or_default());

    let mut wave_index_by_key = HashMap::new();
    let mut current_wave = 0usize;

    while !ready.is_empty() {
        let wave = std::mem::take(&mut ready);
        for task_key in &wave {
            wave_index_by_key.insert(task_key.clone(), current_wave);
        }
        let mut next_ready = Vec::new();
        for task_key in wave {
            for dependent_key in dependents_by_key
                .get(&task_key)
                .cloned()
                .unwrap_or_default()
            {
                let next_indegree = indegree_by_key
                    .get(&dependent_key)
                    .copied()
                    .unwrap_or_default()
                    .saturating_sub(1);
                indegree_by_key.insert(dependent_key.clone(), next_indegree);
                if next_indegree == 0 {
                    next_ready.push(dependent_key);
                }
            }
        }
        next_ready
            .sort_by_key(|task_key| task_index_by_key.get(task_key).copied().unwrap_or_default());
        next_ready.dedup();
        ready = next_ready;
        current_wave += 1;
    }

    wave_index_by_key
}

pub(super) fn schedule_provider_runtime_plan_steps(
    steps: &[ProviderRuntimeStep],
) -> Vec<ScheduledProviderRuntimeStep> {
    let mut assigned_keys = Vec::with_capacity(steps.len());
    let mut used_keys = HashMap::<String, usize>::new();

    for (index, step) in steps.iter().enumerate() {
        let explicit = step
            .task_key
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| default_task_key(step, index));
        let base_key = normalize_task_key(explicit.as_str());
        let count = used_keys.entry(base_key.clone()).or_insert(0);
        *count += 1;
        let task_key = if *count == 1 {
            base_key
        } else {
            format!("{base_key}-{}", *count)
        };
        assigned_keys.push(task_key);
    }

    let known_keys = assigned_keys.iter().cloned().collect::<HashSet<_>>();
    let mut prior_task_keys = Vec::<String>::new();
    let mut latest_barrier_keys = Vec::<String>::new();
    let mut scheduled_steps = Vec::with_capacity(steps.len());

    for (index, step) in steps.iter().cloned().enumerate() {
        let task_key = assigned_keys[index].clone();
        let mut depends_on =
            dedupe_dependency_keys(step.depends_on.as_slice(), task_key.as_str(), &known_keys);
        if is_parallel_safe_step(&step) {
            for barrier_key in &latest_barrier_keys {
                if !depends_on.iter().any(|entry| entry == barrier_key) {
                    depends_on.push(barrier_key.clone());
                }
            }
        } else {
            for prior_key in &prior_task_keys {
                if !depends_on.iter().any(|entry| entry == prior_key) {
                    depends_on.push(prior_key.clone());
                }
            }
        }

        let mut normalized_step = step;
        normalized_step.task_key = Some(task_key.clone());
        normalized_step.depends_on = depends_on.clone();
        let scheduled_step = ScheduledProviderRuntimeStep {
            index,
            task_key: task_key.clone(),
            depends_on,
            wave_index: 0,
            step: normalized_step,
        };
        scheduled_steps.push(scheduled_step);
        prior_task_keys.push(task_key.clone());
        if is_parallel_safe_step(&scheduled_steps[index].step) {
            continue;
        }
        latest_barrier_keys = vec![task_key];
    }

    let wave_index_by_key = compute_wave_indexes(&scheduled_steps);
    for scheduled_step in &mut scheduled_steps {
        scheduled_step.wave_index = wave_index_by_key
            .get(&scheduled_step.task_key)
            .copied()
            .unwrap_or_default();
    }

    scheduled_steps
}

pub(super) fn build_provider_runtime_execution_waves(
    steps: &[ProviderRuntimeStep],
) -> Vec<Vec<ScheduledProviderRuntimeStep>> {
    let scheduled_steps = schedule_provider_runtime_plan_steps(steps);
    let mut waves = Vec::<Vec<ScheduledProviderRuntimeStep>>::new();
    for scheduled_step in scheduled_steps {
        if waves.len() <= scheduled_step.wave_index {
            waves.resize_with(scheduled_step.wave_index + 1, Vec::new);
        }
        waves[scheduled_step.wave_index].push(scheduled_step);
    }
    for wave in &mut waves {
        wave.sort_by_key(|step| step.index);
    }
    waves
}
