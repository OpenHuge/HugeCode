use std::{
    collections::HashMap,
    sync::{atomic::{AtomicBool, AtomicU64, Ordering}, Arc, Mutex},
    time::{Duration, Instant},
};

use axum::extract::FromRef;
use tokio::sync::broadcast;
use tokio::task::{AbortHandle, JoinError, JoinHandle};
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use crate::{
    AppContext, RuntimeDiagnosticsState, ServiceConfig, SharedRuntimeState, TurnEventFrame,
};

/// Transitional top-level state for transport handlers.
///
/// This keeps the existing `AppContext` intact while exposing a smaller state
/// surface for future Axum handlers that want to extract substates instead of
/// depending on the entire context directly.
#[derive(Clone, Copy, Debug)]
pub(crate) enum RuntimeTaskDomain {
    Runtime,
    Subscription,
    Flow,
}

#[derive(Clone, Debug, Default)]
pub(crate) struct RuntimeTaskSupervisorSnapshot {
    pub(crate) active_runtime_tasks: u64,
    pub(crate) active_subscription_tasks: u64,
    pub(crate) active_flow_tasks: u64,
    pub(crate) graceful_shutdown_completed_total: u64,
    pub(crate) forced_abort_total: u64,
    pub(crate) shutdown_wait_timed_out_total: u64,
    pub(crate) last_shutdown_wait_ms: u64,
}

#[derive(Clone, Debug)]
pub(crate) struct RuntimeTaskSupervisor {
    inner: Arc<RuntimeTaskSupervisorInner>,
}

#[derive(Debug)]
struct RuntimeTaskSupervisorInner {
    root_shutdown: CancellationToken,
    tracker: TaskTracker,
    shutdown_grace: Duration,
    next_task_id: AtomicU64,
    shutting_down: AtomicBool,
    active_tasks: Mutex<HashMap<u64, RuntimeTrackedTask>>,
    active_runtime_tasks: AtomicU64,
    active_subscription_tasks: AtomicU64,
    active_flow_tasks: AtomicU64,
    graceful_shutdown_completed_total: AtomicU64,
    forced_abort_total: AtomicU64,
    shutdown_wait_timed_out_total: AtomicU64,
    last_shutdown_wait_ms: AtomicU64,
}

#[derive(Debug)]
struct RuntimeTrackedTask {
    name: String,
    abort_handle: AbortHandle,
}

#[derive(Debug)]
pub(crate) enum RuntimeTaskRunResult<T> {
    Completed(T),
    Cancelled,
}

#[derive(Debug)]
pub(crate) enum RuntimeTaskJoinOutcome<T> {
    Completed(T),
    TimedOutAborted,
}

#[derive(Debug)]
pub(crate) struct RuntimeTaskHandle<T> {
    supervisor: RuntimeTaskSupervisor,
    cancel: Option<CancellationToken>,
    join: Option<JoinHandle<T>>,
}

impl RuntimeTaskSupervisor {
    pub(crate) fn new(shutdown_grace: Duration) -> Self {
        Self {
            inner: Arc::new(RuntimeTaskSupervisorInner {
                root_shutdown: CancellationToken::new(),
                tracker: TaskTracker::new(),
                shutdown_grace,
                next_task_id: AtomicU64::new(0),
                shutting_down: AtomicBool::new(false),
                active_tasks: Mutex::new(HashMap::new()),
                active_runtime_tasks: AtomicU64::new(0),
                active_subscription_tasks: AtomicU64::new(0),
                active_flow_tasks: AtomicU64::new(0),
                graceful_shutdown_completed_total: AtomicU64::new(0),
                forced_abort_total: AtomicU64::new(0),
                shutdown_wait_timed_out_total: AtomicU64::new(0),
                last_shutdown_wait_ms: AtomicU64::new(0),
            }),
        }
    }

    pub(crate) fn snapshot(&self) -> RuntimeTaskSupervisorSnapshot {
        RuntimeTaskSupervisorSnapshot {
            active_runtime_tasks: self.inner.active_runtime_tasks.load(Ordering::Relaxed),
            active_subscription_tasks: self
                .inner
                .active_subscription_tasks
                .load(Ordering::Relaxed),
            active_flow_tasks: self.inner.active_flow_tasks.load(Ordering::Relaxed),
            graceful_shutdown_completed_total: self
                .inner
                .graceful_shutdown_completed_total
                .load(Ordering::Relaxed),
            forced_abort_total: self.inner.forced_abort_total.load(Ordering::Relaxed),
            shutdown_wait_timed_out_total: self
                .inner
                .shutdown_wait_timed_out_total
                .load(Ordering::Relaxed),
            last_shutdown_wait_ms: self.inner.last_shutdown_wait_ms.load(Ordering::Relaxed),
        }
    }

    pub(crate) fn child_token(&self) -> CancellationToken {
        self.inner.root_shutdown.child_token()
    }

    pub(crate) fn spawn_abortable<T, F>(
        &self,
        domain: RuntimeTaskDomain,
        name: impl Into<String>,
        future: F,
    ) -> RuntimeTaskHandle<T>
    where
        T: Send + 'static,
        F: std::future::Future<Output = T> + Send + 'static,
    {
        self.spawn_inner(domain, name.into(), None, future)
    }

    pub(crate) fn spawn_cancellable<T, F>(
        &self,
        domain: RuntimeTaskDomain,
        name: impl Into<String>,
        future: F,
    ) -> RuntimeTaskHandle<RuntimeTaskRunResult<T>>
    where
        T: Send + 'static,
        F: std::future::Future<Output = T> + Send + 'static,
    {
        let cancel = self.child_token();
        let cancel_for_task = cancel.clone();
        let wrapped = async move {
            tokio::select! {
                _ = cancel_for_task.cancelled() => RuntimeTaskRunResult::Cancelled,
                result = future => RuntimeTaskRunResult::Completed(result),
            }
        };
        self.spawn_inner(domain, name.into(), Some(cancel), wrapped)
    }

    pub(crate) async fn shutdown_and_wait(&self) -> RuntimeTaskSupervisorSnapshot {
        self.inner.shutting_down.store(true, Ordering::Relaxed);
        let started_at = Instant::now();
        let active_at_shutdown = self.active_task_count();
        self.inner.root_shutdown.cancel();
        self.inner.tracker.close();

        if tokio::time::timeout(self.inner.shutdown_grace, self.inner.tracker.wait())
            .await
            .is_ok()
        {
            self.record_shutdown_wait_ms(started_at.elapsed());
            self.record_graceful_shutdown_completed(active_at_shutdown);
            return self.snapshot();
        }

        let remaining_tasks = {
            let guard = match self.inner.active_tasks.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard
                .values()
                .map(|task| (task.name.clone(), task.abort_handle.clone()))
                .collect::<Vec<_>>()
        };
        let remaining = u64::try_from(remaining_tasks.len()).unwrap_or(u64::MAX);
        for (name, abort_handle) in remaining_tasks {
            tracing::warn!(task = name.as_str(), "forcing runtime task abort after shutdown timeout");
            abort_handle.abort();
        }
        self.inner.tracker.wait().await;
        self.record_shutdown_wait_timed_out();
        self.record_forced_abort(remaining);
        self.record_graceful_shutdown_completed(active_at_shutdown.saturating_sub(remaining));
        self.record_shutdown_wait_ms(started_at.elapsed());
        self.snapshot()
    }

    pub(crate) fn shutdown_grace(&self) -> Duration {
        self.inner.shutdown_grace
    }

    fn spawn_inner<T, F>(
        &self,
        domain: RuntimeTaskDomain,
        name: String,
        cancel: Option<CancellationToken>,
        future: F,
    ) -> RuntimeTaskHandle<T>
    where
        T: Send + 'static,
        F: std::future::Future<Output = T> + Send + 'static,
    {
        let task_id = self
            .inner
            .next_task_id
            .fetch_add(1, Ordering::Relaxed)
            .saturating_add(1);
        self.increment_active(domain);
        let supervisor = self.clone();
        let name_for_task = name.clone();
        let join = self.inner.tracker.spawn(async move {
            struct RuntimeTaskGuard {
                supervisor: RuntimeTaskSupervisor,
                task_id: u64,
                domain: RuntimeTaskDomain,
            }

            impl Drop for RuntimeTaskGuard {
                fn drop(&mut self) {
                    self.supervisor.complete_task(self.task_id, self.domain);
                }
            }

            let _guard = RuntimeTaskGuard {
                supervisor,
                task_id,
                domain,
            };
            future.await
        });
        let abort_handle = join.abort_handle();
        {
            let mut guard = match self.inner.active_tasks.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard.insert(
                task_id,
                RuntimeTrackedTask {
                    name: name_for_task,
                    abort_handle,
                },
            );
        }
        RuntimeTaskHandle {
            supervisor: self.clone(),
            cancel,
            join: Some(join),
        }
    }

    fn active_task_count(&self) -> u64 {
        let guard = match self.inner.active_tasks.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        u64::try_from(guard.len()).unwrap_or(u64::MAX)
    }

    fn complete_task(&self, task_id: u64, domain: RuntimeTaskDomain) {
        {
            let mut guard = match self.inner.active_tasks.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard.remove(&task_id);
        }
        self.decrement_active(domain);
    }

    fn increment_active(&self, domain: RuntimeTaskDomain) {
        match domain {
            RuntimeTaskDomain::Runtime => {
                self.inner.active_runtime_tasks.fetch_add(1, Ordering::Relaxed);
            }
            RuntimeTaskDomain::Subscription => {
                self.inner
                    .active_subscription_tasks
                    .fetch_add(1, Ordering::Relaxed);
            }
            RuntimeTaskDomain::Flow => {
                self.inner.active_flow_tasks.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    fn decrement_active(&self, domain: RuntimeTaskDomain) {
        match domain {
            RuntimeTaskDomain::Runtime => {
                self.inner.active_runtime_tasks.fetch_sub(1, Ordering::Relaxed);
            }
            RuntimeTaskDomain::Subscription => {
                self.inner
                    .active_subscription_tasks
                    .fetch_sub(1, Ordering::Relaxed);
            }
            RuntimeTaskDomain::Flow => {
                self.inner.active_flow_tasks.fetch_sub(1, Ordering::Relaxed);
            }
        }
    }

    fn record_graceful_shutdown_completed(&self, total: u64) {
        if total > 0 {
            self.inner
                .graceful_shutdown_completed_total
                .fetch_add(total, Ordering::Relaxed);
        }
    }

    fn record_forced_abort(&self, total: u64) {
        if total > 0 {
            self.inner
                .forced_abort_total
                .fetch_add(total, Ordering::Relaxed);
        }
    }

    fn record_shutdown_wait_timed_out(&self) {
        self.inner
            .shutdown_wait_timed_out_total
            .fetch_add(1, Ordering::Relaxed);
    }

    fn record_shutdown_wait_ms(&self, elapsed: Duration) {
        let elapsed_ms = elapsed
            .as_millis()
            .min(u128::from(u64::MAX)) as u64;
        self.inner
            .last_shutdown_wait_ms
            .store(elapsed_ms, Ordering::Relaxed);
    }
}

impl<T> RuntimeTaskHandle<T> {
    pub(crate) fn cancel(&self) {
        if let Some(cancel) = &self.cancel {
            cancel.cancel();
        }
    }

    pub(crate) fn join_future(&mut self) -> &mut JoinHandle<T> {
        self.join
            .as_mut()
            .expect("runtime task handle joined more than once")
    }

    pub(crate) async fn wait(&mut self) -> Result<T, JoinError> {
        let Some(join) = self.join.take() else {
            panic!("runtime task handle joined more than once");
        };
        join.await
    }

    pub(crate) async fn wait_with_timeout_or_abort(
        &mut self,
    ) -> Result<RuntimeTaskJoinOutcome<T>, JoinError> {
        let Some(mut join) = self.join.take() else {
            panic!("runtime task handle joined more than once");
        };
        let started_at = Instant::now();
        match tokio::time::timeout(self.supervisor.shutdown_grace(), &mut join).await {
            Ok(result) => {
                self.supervisor.record_shutdown_wait_ms(started_at.elapsed());
                result.map(RuntimeTaskJoinOutcome::Completed)
            }
            Err(_) => {
                self.supervisor.record_shutdown_wait_timed_out();
                self.supervisor.record_shutdown_wait_ms(started_at.elapsed());
                join.abort();
                let _ = join.await;
                self.supervisor.record_forced_abort(1);
                Ok(RuntimeTaskJoinOutcome::TimedOutAborted)
            }
        }
    }

    pub(crate) async fn cancel_and_wait(&mut self) -> Result<RuntimeTaskJoinOutcome<T>, JoinError> {
        self.cancel();
        let outcome = self.wait_with_timeout_or_abort().await?;
        if matches!(outcome, RuntimeTaskJoinOutcome::Completed(_)) {
            self.supervisor.record_graceful_shutdown_completed(1);
        }
        Ok(outcome)
    }
}

#[derive(Clone)]
pub struct RuntimeAppState {
    context: AppContext,
    _background_tasks: RuntimeBackgroundTasks,
}

impl RuntimeAppState {
    pub(crate) fn new(context: AppContext, background_tasks: RuntimeBackgroundTasks) -> Self {
        Self {
            context,
            _background_tasks: background_tasks,
        }
    }

    pub(crate) fn context(&self) -> &AppContext {
        &self.context
    }

    pub(crate) fn transport_state(&self) -> RuntimeTransportState {
        RuntimeTransportState::from_context(&self.context)
    }

    pub async fn shutdown_background_tasks(&self) {
        self._background_tasks.shutdown_and_wait().await;
        let _ = self.context.task_supervisor.shutdown_and_wait().await;
    }
}

impl From<(AppContext, RuntimeBackgroundTasks)> for RuntimeAppState {
    fn from((context, background_tasks): (AppContext, RuntimeBackgroundTasks)) -> Self {
        Self::new(context, background_tasks)
    }
}

/// Narrow state intended for transport-facing Axum handlers.
#[derive(Clone)]
pub(crate) struct RuntimeTransportState {
    pub(crate) shared_state: SharedRuntimeState,
    pub(crate) config: ServiceConfig,
    pub(crate) runtime_diagnostics: Arc<RuntimeDiagnosticsState>,
    pub(crate) turn_events: broadcast::Sender<TurnEventFrame>,
}

impl RuntimeTransportState {
    fn from_context(context: &AppContext) -> Self {
        Self {
            shared_state: context.state.clone(),
            config: context.config.clone(),
            runtime_diagnostics: context.runtime_diagnostics.clone(),
            turn_events: context.turn_events.clone(),
        }
    }
}

#[derive(Debug)]
pub(crate) struct RuntimeBackgroundTask {
    name: String,
    handle: Mutex<Option<JoinHandle<()>>>,
    shutdown: RuntimeBackgroundTaskShutdown,
}

#[derive(Debug)]
enum RuntimeBackgroundTaskShutdown {
    AbortOnly,
    Graceful(CancellationToken),
}

impl RuntimeBackgroundTask {
    pub(crate) fn abort_only(name: impl Into<String>, handle: JoinHandle<()>) -> Self {
        Self {
            name: name.into(),
            handle: Mutex::new(Some(handle)),
            shutdown: RuntimeBackgroundTaskShutdown::AbortOnly,
        }
    }

    pub(crate) fn graceful(
        name: impl Into<String>,
        shutdown: CancellationToken,
        handle: JoinHandle<()>,
    ) -> Self {
        Self {
            name: name.into(),
            handle: Mutex::new(Some(handle)),
            shutdown: RuntimeBackgroundTaskShutdown::Graceful(shutdown),
        }
    }

    fn signal_shutdown(&self) {
        let guard = match self.handle.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        if guard.is_none() {
            return;
        }
        match &self.shutdown {
            RuntimeBackgroundTaskShutdown::AbortOnly => {
                tracing::debug!(task = self.name.as_str(), "aborting runtime background task");
                if let Some(handle) = guard.as_ref() {
                    handle.abort();
                }
            }
            RuntimeBackgroundTaskShutdown::Graceful(shutdown) => {
                tracing::debug!(task = self.name.as_str(), "cancelling runtime background task");
                shutdown.cancel();
            }
        }
    }

    async fn join(&self) {
        let handle = {
            let mut guard = match self.handle.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard.take()
        };
        let Some(handle) = handle else {
            return;
        };
        let _ = handle.await;
    }
}

impl Drop for RuntimeBackgroundTask {
    fn drop(&mut self) {
        let mut guard = match self.handle.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        if let Some(handle) = guard.take() {
            match &self.shutdown {
                RuntimeBackgroundTaskShutdown::AbortOnly => {
                    tracing::debug!(task = self.name.as_str(), "aborting runtime background task");
                    handle.abort();
                }
                RuntimeBackgroundTaskShutdown::Graceful(shutdown) => {
                    tracing::debug!(task = self.name.as_str(), "cancelling runtime background task");
                    shutdown.cancel();
                }
            }
        }
    }
}

#[derive(Clone, Debug, Default)]
pub(crate) struct RuntimeBackgroundTasks {
    _tasks: Arc<Vec<RuntimeBackgroundTask>>,
}

impl RuntimeBackgroundTasks {
    pub(crate) fn new(tasks: Vec<RuntimeBackgroundTask>) -> Self {
        Self {
            _tasks: Arc::new(tasks),
        }
    }

    pub(crate) async fn shutdown_and_wait(&self) {
        for task in self._tasks.iter() {
            task.signal_shutdown();
        }
        for task in self._tasks.iter() {
            task.join().await;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    use super::*;

    #[tokio::test]
    async fn runtime_task_supervisor_shutdown_waits_for_cancellable_tasks() {
        let supervisor = RuntimeTaskSupervisor::new(Duration::from_millis(50));
        let exited = Arc::new(AtomicBool::new(false));
        let exited_for_task = exited.clone();

        let mut handle = supervisor.spawn_cancellable(
            RuntimeTaskDomain::Flow,
            "test.flow",
            async move {
                tokio::time::sleep(Duration::from_secs(30)).await;
                exited_for_task.store(true, Ordering::Relaxed);
            },
        );

        let report = supervisor.shutdown_and_wait().await;
        let outcome = handle.wait().await.expect("tracked task join should succeed");

        assert!(matches!(outcome, RuntimeTaskRunResult::Cancelled));
        assert!(!exited.load(Ordering::Relaxed));
        assert_eq!(report.active_flow_tasks, 0);
        assert_eq!(report.graceful_shutdown_completed_total, 1);
        assert_eq!(report.forced_abort_total, 0);
    }

    #[tokio::test]
    async fn runtime_task_supervisor_aborts_tasks_that_exceed_grace_window() {
        let supervisor = RuntimeTaskSupervisor::new(Duration::from_millis(10));
        let started = Arc::new(tokio::sync::Notify::new());
        let started_for_task = started.clone();

        let mut handle = supervisor.spawn_abortable(
            RuntimeTaskDomain::Runtime,
            "test.runtime",
            async move {
                started_for_task.notify_one();
                futures_util::future::pending::<()>().await;
            },
        );
        started.notified().await;

        let report = supervisor.shutdown_and_wait().await;
        let join_error = handle.wait().await.expect_err("task should be aborted");
        assert!(join_error.is_cancelled());

        assert_eq!(report.active_runtime_tasks, 0);
        assert_eq!(report.graceful_shutdown_completed_total, 0);
        assert_eq!(report.forced_abort_total, 1);
        assert_eq!(report.shutdown_wait_timed_out_total, 1);
    }

    #[tokio::test]
    async fn runtime_task_supervisor_tracks_active_counts_by_domain() {
        let supervisor = RuntimeTaskSupervisor::new(Duration::from_millis(50));
        let runtime_started = Arc::new(tokio::sync::Notify::new());
        let subscription_started = Arc::new(tokio::sync::Notify::new());
        let runtime_started_for_task = runtime_started.clone();
        let subscription_started_for_task = subscription_started.clone();
        let (runtime_release_tx, runtime_release_rx) = tokio::sync::oneshot::channel::<()>();
        let (subscription_release_tx, subscription_release_rx) =
            tokio::sync::oneshot::channel::<()>();

        let mut runtime_handle = supervisor.spawn_abortable(
            RuntimeTaskDomain::Runtime,
            "test.runtime",
            async move {
                runtime_started_for_task.notify_one();
                let _ = runtime_release_rx.await;
            },
        );
        let mut subscription_handle = supervisor.spawn_cancellable(
            RuntimeTaskDomain::Subscription,
            "test.subscription",
            async move {
                subscription_started_for_task.notify_one();
                let _ = subscription_release_rx.await;
            },
        );

        runtime_started.notified().await;
        subscription_started.notified().await;
        let snapshot = supervisor.snapshot();
        assert_eq!(snapshot.active_runtime_tasks, 1);
        assert_eq!(snapshot.active_subscription_tasks, 1);
        assert_eq!(snapshot.active_flow_tasks, 0);

        let _ = runtime_release_tx.send(());
        let _ = subscription_release_tx.send(());
        let _ = runtime_handle.wait().await.expect("runtime task join");
        let _ = subscription_handle
            .wait()
            .await
            .expect("subscription task join");
        let after = supervisor.snapshot();
        assert_eq!(after.active_runtime_tasks, 0);
        assert_eq!(after.active_subscription_tasks, 0);
    }

    #[tokio::test]
    async fn runtime_background_tasks_drop_cancels_graceful_tasks() {
        let shutdown = CancellationToken::new();
        let exited = Arc::new(AtomicBool::new(false));
        let exited_for_task = exited.clone();
        let shutdown_for_task = shutdown.clone();

        let handle = tokio::spawn(async move {
            shutdown_for_task.cancelled().await;
            exited_for_task.store(true, Ordering::Relaxed);
        });

        let tasks = RuntimeBackgroundTasks::new(vec![RuntimeBackgroundTask::graceful(
            "test.graceful",
            shutdown,
            handle,
        )]);
        drop(tasks);

        tokio::time::timeout(Duration::from_millis(250), async {
            while !exited.load(Ordering::Relaxed) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("graceful background task should observe cancellation");
    }

    #[tokio::test]
    async fn runtime_background_tasks_shutdown_waits_for_graceful_tasks() {
        let shutdown = CancellationToken::new();
        let exited = Arc::new(AtomicBool::new(false));
        let exited_for_task = exited.clone();
        let shutdown_for_task = shutdown.clone();

        let handle = tokio::spawn(async move {
            shutdown_for_task.cancelled().await;
            exited_for_task.store(true, Ordering::Relaxed);
        });

        let tasks = RuntimeBackgroundTasks::new(vec![RuntimeBackgroundTask::graceful(
            "test.graceful",
            shutdown,
            handle,
        )]);
        tasks.shutdown_and_wait().await;

        assert!(
            exited.load(Ordering::Relaxed),
            "graceful background task should exit before shutdown completes"
        );
    }

    #[tokio::test]
    async fn runtime_background_tasks_shutdown_waits_for_aborted_tasks() {
        let (started_tx, started_rx) = tokio::sync::oneshot::channel();
        let handle = tokio::spawn(async move {
            let _ = started_tx.send(());
            futures_util::future::pending::<()>().await;
        });

        let tasks = RuntimeBackgroundTasks::new(vec![RuntimeBackgroundTask::abort_only(
            "test.abort",
            handle,
        )]);
        started_rx
            .await
            .expect("abort-only task should signal startup before shutdown");
        tasks.shutdown_and_wait().await;
    }
}

impl FromRef<RuntimeAppState> for AppContext {
    fn from_ref(state: &RuntimeAppState) -> Self {
        state.context.clone()
    }
}

impl FromRef<RuntimeAppState> for RuntimeTransportState {
    fn from_ref(state: &RuntimeAppState) -> Self {
        Self::from_context(&state.context)
    }
}

impl FromRef<RuntimeTransportState> for SharedRuntimeState {
    fn from_ref(state: &RuntimeTransportState) -> Self {
        state.shared_state.clone()
    }
}

impl FromRef<RuntimeTransportState> for ServiceConfig {
    fn from_ref(state: &RuntimeTransportState) -> Self {
        state.config.clone()
    }
}

impl FromRef<RuntimeTransportState> for Arc<RuntimeDiagnosticsState> {
    fn from_ref(state: &RuntimeTransportState) -> Self {
        state.runtime_diagnostics.clone()
    }
}

impl FromRef<RuntimeTransportState> for broadcast::Sender<TurnEventFrame> {
    fn from_ref(state: &RuntimeTransportState) -> Self {
        state.turn_events.clone()
    }
}
