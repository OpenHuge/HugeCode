import type { ConversationItem } from "../../../types";

export type MetaNoticeType =
  | "modelSwitch"
  | "reasoningChange"
  | "permissionChange"
  | "contextCompaction"
  | "genericMeta";

export type MetaNotice = {
  kind: "metaNotice";
  noticeType: MetaNoticeType;
  title: string;
  description?: string;
  sourceMessageId?: string;
};

const META_NOTICE_COPY: Record<
  MetaNoticeType,
  {
    title: string;
    description: string;
  }
> = {
  modelSwitch: {
    title: "模型已切换",
    description: "会话中途切换模型可能影响回答表现，且上下文可能会被压缩。",
  },
  reasoningChange: {
    title: "推理等级已调整",
    description: "后续回复的速度、细节或推理强度可能有所变化。",
  },
  permissionChange: {
    title: "能力范围已更新",
    description: "当前会话可用的能力或权限发生了变化。",
  },
  contextCompaction: {
    title: "上下文已整理",
    description: "为继续当前会话，部分上下文可能已被压缩，后续回答可能受影响。",
  },
  genericMeta: {
    title: "会话设置已更新",
    description: "当前会话设置发生变化，后续回复可能受影响。",
  },
};

function normalizeMetaNoticeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function cleanMetaNoticeValue(value: string) {
  return value
    .trim()
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, "")
    .replace(/[.。!！?？,:：;；]+$/g, "");
}

function createMetaNotice(
  noticeType: MetaNoticeType,
  sourceMessageId?: string,
  overrides?: Partial<Pick<MetaNotice, "title" | "description">>
): MetaNotice {
  return {
    kind: "metaNotice",
    noticeType,
    title: overrides?.title ?? META_NOTICE_COPY[noticeType].title,
    description: overrides?.description ?? META_NOTICE_COPY[noticeType].description,
    sourceMessageId,
  };
}

function parseModelSwitchNotice(text: string, sourceMessageId?: string): MetaNotice | null {
  const normalized = normalizeMetaNoticeText(text);
  if (
    !/(?:changing\s+models?\s+mid-conversation|switch(?:ed|ing)\s+models?|switch(?:ed|ing)\s+model|model\s+changed|routed\s+model\s+changed|resolved\s+model\s+changed|routed\s+model\s+switched|resolved\s+model\s+switched)/i.test(
      normalized
    )
  ) {
    return null;
  }

  const transitionMatch =
    /(?:model|routed model|resolved model|switch(?:ed|ing)\s+models?)\b.*?\bfrom\s+(.+?)\s+\bto\s+(.+)$/i.exec(
      normalized
    );
  if (!transitionMatch) {
    return createMetaNotice("modelSwitch", sourceMessageId);
  }
  const fromModel = cleanMetaNoticeValue(transitionMatch[1] ?? "");
  const toModel = cleanMetaNoticeValue(transitionMatch[2] ?? "");
  if (!fromModel || !toModel) {
    return createMetaNotice("modelSwitch", sourceMessageId);
  }
  return createMetaNotice("modelSwitch", sourceMessageId, {
    title: `模型已从 ${fromModel} 切换到 ${toModel}`,
  });
}

function parseReasoningChangeNotice(text: string, sourceMessageId?: string): MetaNotice | null {
  const normalized = normalizeMetaNoticeText(text);
  if (
    !/(?:reasoning(?:\s+(?:level|effort))?|thinking(?:\s+mode)?)\b[^.!?\n]*(?:changed|updated|adjusted|switched|set to|now)/i.test(
      normalized
    )
  ) {
    return null;
  }
  return createMetaNotice("reasoningChange", sourceMessageId);
}

function parsePermissionChangeNotice(text: string, sourceMessageId?: string): MetaNotice | null {
  const normalized = normalizeMetaNoticeText(text);
  if (
    !/(?:permissions?|capabilities?|ability|abilities|access mode|tool access|available tools?)\b[^.!?\n]*(?:changed|updated|adjusted|granted|revoked|restricted|expanded)/i.test(
      normalized
    )
  ) {
    return null;
  }
  return createMetaNotice("permissionChange", sourceMessageId);
}

function parseContextCompactionNotice(text: string, sourceMessageId?: string): MetaNotice | null {
  const normalized = normalizeMetaNoticeText(text);
  if (
    !/(?:context\s+(?:may|will|has|was)?\s*(?:automatically\s+)?compact|context compaction|context compacted|compacted for context budget|context may automatically compact|context may compact)/i.test(
      normalized
    )
  ) {
    return null;
  }
  return createMetaNotice("contextCompaction", sourceMessageId);
}

function parseGenericMetaNotice(text: string, sourceMessageId?: string): MetaNotice | null {
  const normalized = normalizeMetaNoticeText(text);
  if (
    !/(?:performance\s+may\s+degrade|degrade\s+performance|session settings changed)/i.test(
      normalized
    )
  ) {
    return null;
  }
  return createMetaNotice("genericMeta", sourceMessageId);
}

export function resolveMetaNotice(item: ConversationItem): MetaNotice | null {
  if (item.kind === "tool" && item.toolType === "contextCompaction") {
    return createMetaNotice("contextCompaction", item.id);
  }
  if (item.kind !== "message" || item.role !== "assistant") {
    return null;
  }
  const text = item.text.trim();
  if (!text) {
    return null;
  }
  return (
    parseModelSwitchNotice(text, item.id) ??
    parseReasoningChangeNotice(text, item.id) ??
    parsePermissionChangeNotice(text, item.id) ??
    parseContextCompactionNotice(text, item.id) ??
    parseGenericMetaNotice(text, item.id)
  );
}
