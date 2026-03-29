export type RuntimeTaskSourceTriggerMode =
  | "assignment"
  | "issue_comment_command"
  | "pull_request_comment_command"
  | "pull_request_review_comment_command"
  | "ci_failure"
  | "manual"
  | (string & {});

export type RuntimeTaskSourceCommandKind = "run" | "continue" | "retry" | (string & {});

export type RuntimeTaskSourceLaunchDisposition =
  | "not_requested"
  | "launched"
  | "intervened"
  | "deduped"
  | "blocked"
  | "failed";

export type RuntimeTaskSourceEventSummary = {
  deliveryId?: string | null;
  eventName: string;
  action?: string | null;
  receivedAt?: number | null;
};

export type RuntimeTaskSourceRequester = {
  login?: string | null;
  id?: number | null;
  type?: string | null;
};

export type RuntimeGitHubSourceLaunchHandshakeState =
  | "prepared"
  | "started"
  | "intervened"
  | "deduped"
  | "blocked"
  | "failed";
