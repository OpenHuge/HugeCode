import type {
  NetbirdStatus,
  RemoteTcpOverlay,
  TailscaleStatus,
  TcpDaemonStatus,
} from "../../../../types";

export function buildSettingsServerSectionViewModel(input: {
  isMobilePlatform: boolean;
  activeTcpOverlay: RemoteTcpOverlay;
  tailscaleStatus: TailscaleStatus | null;
  netbirdStatus: NetbirdStatus | null;
  tcpDaemonStatus: TcpDaemonStatus | null;
}) {
  const tcpRunnerStatusText = (() => {
    if (!input.tcpDaemonStatus) {
      return null;
    }
    if (input.tcpDaemonStatus.state === "running") {
      return input.tcpDaemonStatus.pid
        ? `Mobile daemon is running (pid ${input.tcpDaemonStatus.pid}) on ${input.tcpDaemonStatus.listenAddr ?? "configured listen address"}.`
        : `Mobile daemon is running on ${input.tcpDaemonStatus.listenAddr ?? "configured listen address"}.`;
    }
    if (input.tcpDaemonStatus.state === "error") {
      return input.tcpDaemonStatus.lastError ?? "Mobile daemon is in an error state.";
    }
    return `Mobile daemon is stopped${input.tcpDaemonStatus.listenAddr ? ` (${input.tcpDaemonStatus.listenAddr})` : ""}.`;
  })();

  return {
    isMobileSimplified: input.isMobilePlatform,
    tcpRunnerStatusText,
    activeTcpHelperLabel:
      input.activeTcpOverlay === "netbird" ? "NetBird helper" : "Tailscale helper",
    activeTcpSuggestedHost:
      input.activeTcpOverlay === "netbird"
        ? (input.netbirdStatus?.suggestedRemoteHost ?? null)
        : (input.tailscaleStatus?.suggestedRemoteHost ?? null),
  };
}
