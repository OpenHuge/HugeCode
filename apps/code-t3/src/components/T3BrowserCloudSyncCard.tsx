import { Card, Chip } from "@heroui/react";
import { Cloud } from "lucide-react";
import { useMemo } from "react";
import {
  buildT3BrowserCloudSyncPlan,
  type T3BrowserCloudSyncPlan,
} from "../runtime/t3BrowserCloudSync";
import {
  getT3BrowserProfileSyncState,
  type T3BrowserProfileDescriptor,
  type T3BrowserProfileSyncState,
  type T3BrowserProvider,
  type T3BrowserRecentSession,
} from "../runtime/t3BrowserProfiles";

type T3BrowserCloudSyncCardProps = {
  customProductUrl: string;
  profile: T3BrowserProfileDescriptor | null;
  providerId: T3BrowserProvider;
  recentSessions: readonly T3BrowserRecentSession[];
  syncState: T3BrowserProfileSyncState | null;
};

export function T3BrowserCloudSyncCard({
  customProductUrl,
  profile,
  providerId,
  recentSessions,
  syncState,
}: T3BrowserCloudSyncCardProps) {
  const plan = useMemo<T3BrowserCloudSyncPlan | null>(() => {
    if (!profile || (providerId === "custom" && !customProductUrl.trim())) {
      return null;
    }
    try {
      return buildT3BrowserCloudSyncPlan({
        customUrl: customProductUrl,
        profile,
        providerId,
        recentSessions,
        syncState: syncState ?? getT3BrowserProfileSyncState(profile),
      });
    } catch {
      return null;
    }
  }, [customProductUrl, profile, providerId, recentSessions, syncState]);

  if (!plan) {
    return null;
  }

  return (
    <Card
      className="t3-browser-cloud-sync"
      variant="secondary"
      aria-label="Multi-device cloud sync plan"
    >
      <Card.Header className="t3-browser-card-header">
        <span>
          <Cloud size={13} />
          Device cloud sync
        </span>
        <Chip
          color={plan.siteRisk === "sensitive" ? "warning" : "success"}
          size="sm"
          variant="soft"
        >
          {plan.siteRisk}
        </Chip>
      </Card.Header>
      <div>
        <Chip size="sm" variant="tertiary">
          {plan.globalLayer.status}
        </Chip>
        <Chip size="sm" variant="tertiary">
          local overlay {plan.localOverlay.status}
        </Chip>
        <Chip size="sm" variant="tertiary">
          {plan.sessionContinuity.mode}
        </Chip>
      </div>
      <small>{plan.summary}</small>
      <small>
        {plan.sessionContinuity.canResumeWebLogin
          ? "Trusted devices can resume through an encrypted cloud-managed browser-state bundle."
          : "Create a profile snapshot before this site can restore login state on another device."}
      </small>
    </Card>
  );
}
