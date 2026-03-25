export type MissionNavigationTarget =
  | {
      kind: "thread";
      workspaceId: string;
      threadId: string;
    }
  | {
      kind: "mission";
      workspaceId: string;
      taskId: string;
      runId: string | null;
      reviewPackId: string | null;
      threadId: string | null;
      limitation: "thread_unavailable" | null;
    }
  | {
      kind: "review";
      workspaceId: string;
      taskId: string;
      runId: string | null;
      reviewPackId: string | null;
      limitation: "thread_unavailable" | null;
    };
