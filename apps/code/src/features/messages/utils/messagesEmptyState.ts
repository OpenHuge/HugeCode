type MessagesEmptyStateParams = {
  threadId: string | null;
  isRestoringThreadHistory: boolean;
};

type MessagesEmptyState = {
  eyebrow: string;
  title: string;
  description: string;
  checklistTitle?: string;
  showStepNumbers?: boolean;
  steps: Array<{
    id: string;
    label: string;
    detail?: string;
    badge?: string;
    tone?: "skills" | "commands" | "mentions" | "queue" | "images";
  }>;
  loadingTitle: string;
  loadingLabel: string;
};

export function resolveMessagesEmptyState({
  threadId,
  isRestoringThreadHistory,
}: MessagesEmptyStateParams): MessagesEmptyState {
  if (isRestoringThreadHistory) {
    return {
      eyebrow: "Recent history",
      title: "Restoring recent threads",
      description:
        "Loading the latest thread for this workspace so the conversation can continue with the right context.",
      checklistTitle: "Recovery flow",
      steps: [
        { id: "load-history", label: "Load recent threads" },
        { id: "restore-context", label: "Restore latest context" },
        { id: "resume-thread", label: "Resume the active conversation" },
      ],
      loadingTitle: "Restoring recent threads",
      loadingLabel: "Loading history…",
    };
  }

  if (threadId) {
    return {
      eyebrow: "Composer",
      title: "Continue in the composer.",
      description:
        "Add the next instruction without restating the full thread. Use skills, commands, and mentions directly from the composer.",
      showStepNumbers: false,
      steps: [
        {
          id: "skills",
          badge: "$",
          label: "Skills",
          detail: "Insert project or global skills inline.",
          tone: "skills",
        },
        {
          id: "commands",
          badge: "/",
          label: "Commands",
          detail: "Run built-ins like /review without leaving the composer.",
          tone: "commands",
        },
        {
          id: "mentions",
          badge: "@",
          label: "Mentions",
          detail: "Mention workspace files and targets directly in the draft.",
          tone: "mentions",
        },
      ],
      loadingTitle: "Loading this thread",
      loadingLabel: "Loading…",
    };
  }

  return {
    eyebrow: "Composer",
    title: "Start in the composer.",
    description:
      "Describe the task in plain language, then add the right context with skills, commands, and mentions directly in the composer.",
    showStepNumbers: false,
    steps: [
      {
        id: "skills",
        badge: "$",
        label: "Skills",
        detail: "Insert project or global skills inline.",
        tone: "skills",
      },
      {
        id: "commands",
        badge: "/",
        label: "Commands",
        detail: "Use built-in or saved commands from the same field.",
        tone: "commands",
      },
      {
        id: "mentions",
        badge: "@",
        label: "Mentions",
        detail: "Mention workspace files and targets without switching panels.",
        tone: "mentions",
      },
    ],
    loadingTitle: "Preparing a new agent",
    loadingLabel: "Loading…",
  };
}
