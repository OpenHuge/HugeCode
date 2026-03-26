import { useEffect, useMemo, useState } from "react";
import { CODE_WEB_OFFLINE_PATH } from "./pwaConfig";
import {
  applyPwaDocumentState,
  detectManualInstallPlatform,
  detectPwaDisplayMode,
  isStandaloneLikeDisplayMode,
  readDismissedInstallPrompt,
  resolveLaunchNavigationTarget,
  resolveServiceWorkerPath,
  type BeforeInstallPromptEvent,
  useNavigatorOnlineStatus,
  writeDismissedInstallPrompt,
} from "./browserPwa";
import {
  pwaBannerActions,
  pwaBannerCard,
  pwaBannerCopy,
  pwaBannerDismissButton,
  pwaBannerEyebrow,
  pwaBannerPrimaryButton,
  pwaBannerSecondaryButton,
  pwaBannerTitle,
  pwaBannerViewport,
} from "../web.css";

type PwaBannerKind = "install" | "manual-install" | "offline" | "update" | null;
const SERVICE_WORKER_PATH = resolveServiceWorkerPath();

type WindowLaunchQueue = {
  setConsumer: (consumer: (launchParams: { targetURL?: string | URL | null }) => void) => void;
};

export function WebPwaLifecycle() {
  const online = useNavigatorOnlineStatus();
  const [displayMode, setDisplayMode] = useState(() => detectPwaDisplayMode());
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installDismissed, setInstallDismissed] = useState(false);
  const [manualInstallDismissed, setManualInstallDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const dismissed = readDismissedInstallPrompt();
    setInstallDismissed(dismissed);
    setManualInstallDismissed(dismissed);
  }, []);

  useEffect(() => {
    const syncDisplayMode = () => {
      setDisplayMode(detectPwaDisplayMode());
    };

    syncDisplayMode();

    if (typeof window === "undefined") {
      return () => undefined;
    }

    const subscriptions = [
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: window-controls-overlay)"),
      window.matchMedia("(display-mode: minimal-ui)"),
    ];
    subscriptions.forEach((mediaQuery) => {
      mediaQuery.addEventListener("change", syncDisplayMode);
    });
    window.addEventListener("appinstalled", syncDisplayMode);

    return () => {
      subscriptions.forEach((mediaQuery) => {
        mediaQuery.removeEventListener("change", syncDisplayMode);
      });
      window.removeEventListener("appinstalled", syncDisplayMode);
    };
  }, []);

  useEffect(() => {
    applyPwaDocumentState({ displayMode, online });
  }, [displayMode, online]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return () => undefined;
    }

    let controllerChangeHandled = false;
    const handleControllerChange = () => {
      if (controllerChangeHandled) {
        return;
      }
      controllerChangeHandled = true;
      window.location.reload();
    };
    const handleRegistrationState = (registration: ServiceWorkerRegistration) => {
      setServiceWorkerRegistration(registration);
      if (registration.waiting) {
        setNeedRefresh(true);
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            setNeedRefresh(true);
          }
        });
      });
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void navigator.serviceWorker
      .register(SERVICE_WORKER_PATH)
      .then((registration) => {
        handleRegistrationState(registration);
        void registration.update().catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const launchQueue = (window as Window & { launchQueue?: WindowLaunchQueue }).launchQueue;
    launchQueue?.setConsumer((launchParams) => {
      const nextLocation = resolveLaunchNavigationTarget({
        currentUrl: window.location.href,
        targetUrl: launchParams.targetURL,
      });
      if (nextLocation) {
        window.location.assign(nextLocation);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setInstallDismissed(false);
      setManualInstallDismissed(true);
      writeDismissedInstallPrompt(false);
      setDisplayMode(detectPwaDisplayMode());
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installed = isStandaloneLikeDisplayMode(displayMode);
  const manualInstallPlatform = useMemo(() => {
    return installed ? null : detectManualInstallPlatform();
  }, [installed]);
  const canPromptInstall = Boolean(installPromptEvent) && !installed && !installDismissed;
  const canShowManualInstall =
    !canPromptInstall && !installed && Boolean(manualInstallPlatform) && !manualInstallDismissed;

  const bannerKind: PwaBannerKind = needRefresh
    ? "update"
    : !online
      ? "offline"
      : canPromptInstall
        ? "install"
        : canShowManualInstall
          ? "manual-install"
          : null;

  if (!bannerKind) {
    return null;
  }

  const dismissInstallBanner = () => {
    setInstallDismissed(true);
    setManualInstallDismissed(true);
    writeDismissedInstallPrompt(true);
  };

  const handleInstall = async () => {
    if (!installPromptEvent) {
      return;
    }

    setInstalling(true);
    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === "dismissed") {
        dismissInstallBanner();
      }
    } finally {
      setInstalling(false);
      setInstallPromptEvent(null);
    }
  };

  const handleManualDismiss = () => {
    dismissInstallBanner();
  };

  return (
    <section className={pwaBannerViewport} aria-live="polite" aria-label="PWA status">
      {bannerKind === "update" ? (
        <div className={pwaBannerCard}>
          <span className={pwaBannerEyebrow}>Update ready</span>
          <strong className={pwaBannerTitle}>A newer HugeCode shell is available.</strong>
          <p className={pwaBannerCopy}>
            Refresh when you are ready. HugeCode uses a prompt update flow so long-running workspace
            sessions are not interrupted mid-task.
          </p>
          <div className={pwaBannerActions}>
            <button
              className={pwaBannerPrimaryButton}
              onClick={() => {
                serviceWorkerRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
              }}
              type="button"
            >
              Update now
            </button>
          </div>
        </div>
      ) : null}

      {bannerKind === "offline" ? (
        <div className={pwaBannerCard}>
          <span className={pwaBannerEyebrow}>Offline mode</span>
          <strong className={pwaBannerTitle}>HugeCode is running from cache.</strong>
          <p className={pwaBannerCopy}>
            Public routes remain available offline. The workspace shell can still open, but runtime
            RPC and live execution reconnect only when your network and gateway return.
          </p>
          <div className={pwaBannerActions}>
            <a className={pwaBannerSecondaryButton} href={CODE_WEB_OFFLINE_PATH}>
              Offline guide
            </a>
            <button
              className={pwaBannerPrimaryButton}
              onClick={() => {
                window.location.reload();
              }}
              type="button"
            >
              Retry connection
            </button>
          </div>
        </div>
      ) : null}

      {bannerKind === "install" ? (
        <div className={pwaBannerCard}>
          <span className={pwaBannerEyebrow}>Install HugeCode</span>
          <strong className={pwaBannerTitle}>Launch the web workspace like an app.</strong>
          <p className={pwaBannerCopy}>
            Installing HugeCode opens directly into <code>/app</code>, keeps the public shell
            available offline, and gives desktop browsers a cleaner standalone window.
          </p>
          <div className={pwaBannerActions}>
            <button
              className={pwaBannerPrimaryButton}
              disabled={installing}
              onClick={() => {
                void handleInstall();
              }}
              type="button"
            >
              {installing ? "Opening install prompt" : "Install HugeCode"}
            </button>
            <button className={pwaBannerDismissButton} onClick={dismissInstallBanner} type="button">
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {bannerKind === "manual-install" ? (
        <div className={pwaBannerCard}>
          <span className={pwaBannerEyebrow}>Install HugeCode</span>
          <strong className={pwaBannerTitle}>
            {manualInstallPlatform === "ios"
              ? "Add HugeCode to Home Screen from the Share menu."
              : "Use Safari File > Add to Dock to install HugeCode."}
          </strong>
          <p className={pwaBannerCopy}>
            {manualInstallPlatform === "ios"
              ? "Safari on iPhone and iPad does not expose the install prompt event, so HugeCode falls back to the standard Share menu flow."
              : "Safari on macOS promotes installed web apps through Add to Dock instead of the Chromium install prompt event."}
          </p>
          <div className={pwaBannerActions}>
            <button className={pwaBannerDismissButton} onClick={handleManualDismiss} type="button">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
