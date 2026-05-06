import type { AccessMode, ReasonEffort } from "@ku0/code-runtime-host-contract";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";

export type T3WorkspaceLocale = "en" | "zh";

export const T3_WORKSPACE_LOCALE_STORAGE_KEY = "hugecode:t3-workspace-locale";

export type T3WorkspaceMessages = {
  addProject: string;
  assistantOperationPage: string;
  assistantOperationTag: string;
  browser: string;
  browserAccountImportCodeLabel: string;
  browserAccountImportCodePlaceholder: string;
  browserAccountDataGatePrimary: string;
  browserAccountDataGateSubtitle: string;
  browserAccountDataGateTitle: string;
  browserAccountDataLoginState: string;
  browserImportChatGptAccount: string;
  browserImportData: string;
  browserRedeemData: string;
  browserRedemptionCodeLabel: string;
  browserRedemptionCodePlaceholder: string;
  browserRemoteDataGateSubtitle: string;
  browserRemoteDataGateTitle: string;
  browserSubtitle: string;
  build: string;
  closeSidebar: string;
  composerAccessMode: string;
  composerMode: string;
  composerModelProvider: string;
  composerPlaceholder: string;
  composerReasoningEffort: string;
  currentProject: string;
  devStage: string;
  emptyThreadSubtitle: string;
  emptyThreadTitle: string;
  fullAccess: string;
  language: string;
  languageSwitchToEnglish: string;
  languageSwitchToChinese: string;
  localCli: string;
  newThread: string;
  plan: string;
  projects: string;
  providers: string;
  readOnly: string;
  refreshLocalProviders: string;
  runtimeDefault: string;
  search: string;
  settings: string;
  startTask: string;
  supervised: string;
  taskInstruction: string;
  threads: string;
  toggleSidebar: string;
  unavailable: string;
  ready: string;
  attention: string;
  blocked: string;
  unknown: string;
  accountRental: string;
  accountRentalSubtitle: string;
  accountRentalPageLabel: string;
  relayAssistant: string;
  relayAssistantSubtitle: string;
  relayAssistantPageLabel: string;
  startupEntries: string;
  mainActionEntries: string;
  backToStartup: string;
  commandModelDescription: string;
  commandPlanDescription: string;
  commandDefaultDescription: string;
  enterInstructionNotice: string;
  relayRouteAppliedNotice: (backendLabel: string) => string;
  modeTimelineLabel: string;
  normal: string;
  accessTimelineLabel: string;
  reasoningTimelineLabel: string;
  preferredBackendsTimelineLabel: string;
  runtimeFallback: string;
  planTitlePrefix: string;
};

const messages: Record<T3WorkspaceLocale, T3WorkspaceMessages> = {
  en: {
    accessTimelineLabel: "Access",
    accountRental: "Account pool management",
    accountRentalPageLabel: "Account pool management operation page",
    accountRentalSubtitle: "Manage built-in Pro account pools",
    addProject: "Add project",
    assistantOperationPage: "Operation page",
    assistantOperationTag: "Operation",
    attention: "Attention",
    backToStartup: "Back to startup entries",
    blocked: "Blocked",
    browser: "Browser",
    browserAccountImportCodeLabel: "File unlock code",
    browserAccountImportCodePlaceholder: "Enter file unlock code",
    browserAccountDataGatePrimary: "Import account data",
    browserAccountDataGateSubtitle:
      "HugeCode needs encrypted browser account data before startup tools are available. Import succeeds before the built-in ChatGPT browser is opened.",
    browserAccountDataGateTitle: "Import account data",
    browserAccountDataLoginState: "Encrypted account state",
    browserImportChatGptAccount: "Open ChatGPT built-in browser",
    browserImportData: "Import browser file",
    browserRedeemData: "Confirm",
    browserRedemptionCodeLabel: "Redemption code",
    browserRedemptionCodePlaceholder: "Enter redemption code...",
    browserRemoteDataGateSubtitle: "Enter your redemption code.",
    browserRemoteDataGateTitle: "Redeem delivery",
    browserSubtitle: "Open managed product browser",
    build: "Build",
    closeSidebar: "Close sidebar",
    commandDefaultDescription: "Switch this thread back to normal build mode",
    commandModelDescription: "Switch response model for this thread",
    commandPlanDescription: "Switch this thread into plan mode",
    composerAccessMode: "Composer access mode",
    composerMode: "Composer mode",
    composerModelProvider: "Composer model provider",
    composerPlaceholder: "Ask for follow-up changes or attach images",
    composerReasoningEffort: "Composer reasoning effort",
    currentProject: "Current project",
    devStage: "Dev",
    emptyThreadSubtitle: "HugeCode runtime will choose a local backend.",
    emptyThreadTitle: "Send a message to start the conversation.",
    enterInstructionNotice: "Enter an instruction before launching a task.",
    fullAccess: "Full access",
    language: "Language",
    languageSwitchToChinese: "中文",
    languageSwitchToEnglish: "English",
    localCli: "local CLI",
    mainActionEntries: "Main action entries",
    modeTimelineLabel: "Mode",
    newThread: "New thread",
    normal: "Normal",
    plan: "Plan",
    planTitlePrefix: "Plan",
    preferredBackendsTimelineLabel: "Preferred backends",
    projects: "Projects",
    providers: "Providers",
    readOnly: "Read-only",
    ready: "Ready",
    reasoningTimelineLabel: "Reasoning",
    refreshLocalProviders: "Refresh local providers",
    relayAssistant: "Relay assistant",
    relayAssistantPageLabel: "Relay assistant operation page",
    relayAssistantSubtitle: "Codex OpenAI-compatible route",
    relayRouteAppliedNotice: (backendLabel) =>
      `${backendLabel} is now the built-in Codex relay route.`,
    runtimeDefault: "runtime default",
    runtimeFallback: "runtime fallback",
    search: "Search",
    settings: "Settings",
    startTask: "Start task",
    startupEntries: "Startup entries",
    supervised: "Supervised",
    taskInstruction: "Task instruction",
    threads: "Threads",
    toggleSidebar: "Toggle sidebar",
    unavailable: "Unavailable",
    unknown: "Unknown",
  },
  zh: {
    accessTimelineLabel: "权限",
    accountRental: "账户池管理",
    accountRentalPageLabel: "账户池管理操作页",
    accountRentalSubtitle: "内置 Pro 账户池管理",
    addProject: "添加项目",
    assistantOperationPage: "操作页",
    assistantOperationTag: "操作页",
    attention: "需关注",
    backToStartup: "返回启动入口",
    blocked: "阻塞",
    browser: "浏览器",
    browserAccountImportCodeLabel: "文件解锁码",
    browserAccountImportCodePlaceholder: "输入文件解锁码",
    browserAccountDataGatePrimary: "导入账户数据",
    browserAccountDataGateSubtitle:
      "HugeCode 需要先恢复加密浏览器账户数据，启动入口才会开放。导入成功后才会打开 ChatGPT 内置浏览器。",
    browserAccountDataGateTitle: "导入账户数据",
    browserAccountDataLoginState: "加密账户状态",
    browserImportChatGptAccount: "打开 ChatGPT 内置浏览器",
    browserImportData: "导入浏览器文件",
    browserRedeemData: "确定",
    browserRedemptionCodeLabel: "兑换码",
    browserRedemptionCodePlaceholder: "输入兑换码...",
    browserRemoteDataGateSubtitle: "请输入兑换码。",
    browserRemoteDataGateTitle: "兑换交付",
    browserSubtitle: "打开托管产品浏览器",
    build: "构建",
    closeSidebar: "关闭侧栏",
    commandDefaultDescription: "切回普通构建模式",
    commandModelDescription: "切换当前线程的响应模型",
    commandPlanDescription: "切换当前线程到计划模式",
    composerAccessMode: "Composer 权限模式",
    composerMode: "Composer 模式",
    composerModelProvider: "Composer 模型提供方",
    composerPlaceholder: "输入后续修改要求，或附加图片",
    composerReasoningEffort: "Composer 推理强度",
    currentProject: "当前项目",
    devStage: "开发",
    emptyThreadSubtitle: "HugeCode runtime 会选择一个本地后端。",
    emptyThreadTitle: "发送消息开始对话。",
    enterInstructionNotice: "启动任务前请输入指令。",
    fullAccess: "完全访问",
    language: "语言",
    languageSwitchToChinese: "中文",
    languageSwitchToEnglish: "English",
    localCli: "本地 CLI",
    mainActionEntries: "主操作入口",
    modeTimelineLabel: "模式",
    newThread: "新线程",
    normal: "常规",
    plan: "计划",
    planTitlePrefix: "计划",
    preferredBackendsTimelineLabel: "首选后端",
    projects: "项目",
    providers: "提供方",
    readOnly: "只读",
    ready: "就绪",
    reasoningTimelineLabel: "推理",
    refreshLocalProviders: "刷新本地提供方",
    relayAssistant: "中转助手",
    relayAssistantPageLabel: "中转助手操作页",
    relayAssistantSubtitle: "Codex OpenAI-compatible 路由",
    relayRouteAppliedNotice: (backendLabel) => `${backendLabel} 已设为内置 Codex 中转路由。`,
    runtimeDefault: "runtime 默认",
    runtimeFallback: "runtime 兜底",
    search: "搜索",
    settings: "设置",
    startTask: "启动任务",
    startupEntries: "启动入口",
    supervised: "监督模式",
    taskInstruction: "任务指令",
    threads: "线程",
    toggleSidebar: "切换侧栏",
    unavailable: "不可用",
    unknown: "未知",
  },
};

export function resolveT3WorkspaceLocale(value: unknown): T3WorkspaceLocale | null {
  return value === "zh" || value === "en" ? value : null;
}

export function detectT3WorkspaceLocale(): T3WorkspaceLocale {
  const stored = resolveT3WorkspaceLocale(
    window.localStorage.getItem(T3_WORKSPACE_LOCALE_STORAGE_KEY)
  );
  if (stored) {
    return stored;
  }
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function getT3WorkspaceMessages(locale: T3WorkspaceLocale): T3WorkspaceMessages {
  return messages[locale];
}

export function getT3WorkspaceAccessModeLabel(locale: T3WorkspaceLocale, mode: AccessMode) {
  const text = getT3WorkspaceMessages(locale);
  if (mode === "read-only") {
    return text.readOnly;
  }
  return mode === "full-access" ? text.fullAccess : text.supervised;
}

export function getT3WorkspaceReasonEffortLabel(locale: T3WorkspaceLocale, effort: ReasonEffort) {
  if (locale === "zh") {
    if (effort === "low") return "低";
    if (effort === "medium") return "中";
    if (effort === "high") return "高";
    return "超高";
  }
  if (effort === "low") return "Low";
  if (effort === "medium") return "Medium";
  if (effort === "high") return "High";
  return "Extra High";
}

export function getT3WorkspaceStatusLabel(
  locale: T3WorkspaceLocale,
  route: T3CodeProviderRoute | undefined
) {
  const text = getT3WorkspaceMessages(locale);
  if (!route) {
    return text.unavailable;
  }
  if (route.status === "ready") {
    return text.ready;
  }
  if (route.status === "attention") {
    return text.attention;
  }
  if (route.status === "blocked") {
    return text.blocked;
  }
  return text.unknown;
}
