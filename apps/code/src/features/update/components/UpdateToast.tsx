import { lazy, Suspense } from "react";
import { openUrl } from "../../../application/runtime/facades/desktopHostFacade";
import { Button } from "../../../design-system";
import {
  ToastActions,
  ToastBody,
  ToastCard,
  ToastError,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "../../../design-system";
import type { PostUpdateNoticeState, UpdateState } from "../hooks/useUpdater";

const LazyUpdateToastReleaseNotes = lazy(async () => {
  const module = await import("./UpdateToastReleaseNotes");
  return { default: module.UpdateToastReleaseNotes };
});

type UpdateToastProps = {
  state: UpdateState;
  onUpdate: () => void;
  onDismiss: () => void;
  postUpdateNotice?: PostUpdateNoticeState;
  onDismissPostUpdateNotice?: () => void;
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

async function openExternalUrl(url: string) {
  try {
    await openUrl(url);
    return;
  } catch {
    // Ignore: the update surfaces already degrade gracefully when external links cannot open.
  }
}

export function UpdateToast({
  state,
  onUpdate,
  onDismiss,
  postUpdateNotice = null,
  onDismissPostUpdateNotice,
}: UpdateToastProps) {
  if (postUpdateNotice) {
    return (
      <ToastViewport className="update-toasts" role="region" ariaLive="polite">
        <ToastCard className="update-toast" role="status">
          <ToastHeader className="update-toast-header">
            <ToastTitle className="update-toast-title">What's New</ToastTitle>
            <div className="update-toast-version">v{postUpdateNotice.version}</div>
          </ToastHeader>
          {postUpdateNotice.stage === "loading" ? (
            <ToastBody className="update-toast-body">
              Updated successfully. Loading release notes...
            </ToastBody>
          ) : null}
          {postUpdateNotice.stage === "ready" ? (
            <>
              <ToastBody className="update-toast-body">
                Updated successfully. Here is what is new:
              </ToastBody>
              <div className="update-toast-notes" role="document">
                <Suspense
                  fallback={
                    <ToastBody className="update-toast-body">Loading release notes...</ToastBody>
                  }
                >
                  <LazyUpdateToastReleaseNotes
                    body={postUpdateNotice.body}
                    onOpenExternalUrl={openExternalUrl}
                  />
                </Suspense>
              </div>
            </>
          ) : null}
          {postUpdateNotice.stage === "fallback" ? (
            <ToastBody className="update-toast-body">
              Updated to v{postUpdateNotice.version}. Release notes could not be loaded.
            </ToastBody>
          ) : null}
          <ToastActions className="update-toast-actions">
            {postUpdateNotice.stage !== "loading" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void openExternalUrl(postUpdateNotice.htmlUrl);
                }}
              >
                View on GitHub
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onDismissPostUpdateNotice ?? onDismiss}>
              Dismiss
            </Button>
          </ToastActions>
        </ToastCard>
      </ToastViewport>
    );
  }

  if (state.stage === "idle") {
    return null;
  }

  const totalBytes = state.progress?.totalBytes;
  const downloadedBytes = state.progress?.downloadedBytes ?? 0;
  const percent =
    totalBytes && totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : null;

  return (
    <ToastViewport className="update-toasts" role="region" ariaLive="polite">
      <ToastCard className="update-toast" role="status">
        <ToastHeader className="update-toast-header">
          <ToastTitle className="update-toast-title">Update</ToastTitle>
          {state.version ? <div className="update-toast-version">v{state.version}</div> : null}
        </ToastHeader>
        {state.stage === "checking" && (
          <ToastBody className="update-toast-body">Checking for updates...</ToastBody>
        )}
        {state.stage === "available" && (
          <>
            <ToastBody className="update-toast-body">A new version is available.</ToastBody>
            <ToastActions className="update-toast-actions">
              <Button variant="secondary" size="sm" onClick={onDismiss}>
                Later
              </Button>
              <Button variant="primary" size="sm" onClick={onUpdate}>
                Update
              </Button>
            </ToastActions>
          </>
        )}
        {state.stage === "latest" && (
          <div className="update-toast-inline">
            <ToastBody className="update-toast-body update-toast-body-inline">
              You're up to date.
            </ToastBody>
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        )}
        {state.stage === "downloading" && (
          <>
            <ToastBody className="update-toast-body">Downloading update...</ToastBody>
            <div className="update-toast-progress">
              <progress
                className="update-toast-progress-bar"
                value={percent ?? 24}
                max={100}
                aria-label="Update download progress"
              />
              <div className="update-toast-progress-meta">
                {totalBytes
                  ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                  : `${formatBytes(downloadedBytes)} downloaded`}
              </div>
            </div>
          </>
        )}
        {state.stage === "downloaded" && (
          <>
            <ToastBody className="update-toast-body">
              Update ready. Restart HugeCode to apply it.
            </ToastBody>
            <ToastActions className="update-toast-actions">
              <Button variant="secondary" size="sm" onClick={onDismiss}>
                Later
              </Button>
              <Button variant="primary" size="sm" onClick={onUpdate}>
                Restart Now
              </Button>
            </ToastActions>
          </>
        )}
        {state.stage === "installing" && (
          <ToastBody className="update-toast-body">Installing update...</ToastBody>
        )}
        {state.stage === "restarting" && (
          <ToastBody className="update-toast-body">Restarting...</ToastBody>
        )}
        {state.stage === "error" && (
          <>
            <ToastBody className="update-toast-body">Update failed.</ToastBody>
            {state.error ? (
              <ToastError className="update-toast-error">{state.error}</ToastError>
            ) : null}
            <ToastActions className="update-toast-actions">
              <Button variant="secondary" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
              <Button variant="primary" size="sm" onClick={onUpdate}>
                Retry
              </Button>
            </ToastActions>
          </>
        )}
      </ToastCard>
    </ToastViewport>
  );
}
