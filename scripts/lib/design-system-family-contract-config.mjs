export const DESIGN_SYSTEM_FAMILY_CONTRACTS = [
  {
    familyName: "Button",
    publicComponentName: "Button",
    requiredUiExports: ["Button"],
    inspectionSurface: "Button",
    requiredDesignSystemTest: "packages/design-system/src/components/Button.test.tsx",
    requiredUiTest: "packages/ui/src/components/Button.compat.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/home/components/Home.tsx",
          importSource: "app_design_system",
          requiredImports: ["Button"],
          requiredUsageSnippets: ["<Button"],
        },
        {
          relativePath: "apps/code/src/features/prompts/components/PromptPanel.tsx",
          importSource: "app_design_system",
          requiredImports: ["Button"],
          requiredUsageSnippets: ["<Button"],
        },
        {
          relativePath: "apps/code/src/features/composer/components/ComposerInput.tsx",
          importSource: "app_design_system",
          requiredImports: ["Button"],
          requiredUsageSnippets: ["<Button"],
        },
      ],
    },
  },
  {
    familyName: "Input",
    publicComponentName: "Input",
    requiredUiExports: ["Input"],
    inspectionSurface: "Input",
    requiredDesignSystemTest: "packages/design-system/src/components/Input.test.tsx",
    requiredUiTest: "packages/ui/src/components/Button.compat.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/home/components/HomeRuntimeNotice.tsx",
          importSource: "app_design_system",
          requiredImports: ["Input"],
          requiredUsageSnippets: ["<Input"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/SettingsDisplaySection.tsx",
          importSource: "app_design_system",
          requiredImports: ["Input"],
          requiredUsageSnippets: ["<Input"],
        },
        {
          relativePath: "apps/code/src/features/app/components/LaunchScriptButton.tsx",
          importSource: "app_design_system",
          requiredImports: ["Input"],
          requiredUsageSnippets: ["<Input"],
        },
      ],
    },
  },
  {
    familyName: "Checkbox",
    publicComponentName: "Checkbox",
    requiredUiExports: ["Checkbox"],
    inspectionSurface: "Checkbox",
    requiredDesignSystemTest: "packages/design-system/src/components/Checkbox.test.tsx",
    requiredUiTest: "packages/ui/src/components/Checkbox.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/debug/components/DebugRuntimeLiveSkillForm.tsx",
          importSource: "app_design_system",
          requiredImports: ["Checkbox"],
          requiredUsageSnippets: ["<Checkbox"],
        },
        {
          relativePath:
            "apps/code/src/features/composer/components/ComposerToolCallRequestPanel.tsx",
          importSource: "app_design_system",
          requiredImports: ["Checkbox"],
          requiredUsageSnippets: ["<Checkbox"],
        },
        {
          relativePath: "apps/code/src/features/atlas/components/AtlasPanel.tsx",
          importSource: "app_design_system",
          requiredImports: ["Checkbox"],
          requiredUsageSnippets: ["<Checkbox"],
        },
      ],
    },
  },
  {
    familyName: "RadioGroup",
    publicComponentName: "RadioGroup",
    requiredUiExports: ["RadioGroup"],
    inspectionSurface: "RadioGroup",
    requiredDesignSystemTest: "packages/design-system/src/components/RadioGroup.test.tsx",
    requiredUiTest: "packages/ui/src/components/RadioGroup.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/app/components/RequestUserInputMessage.tsx",
          importSource: "app_design_system",
          requiredImports: ["RadioGroup"],
          requiredUsageSnippets: ["<RadioGroup"],
        },
      ],
    },
  },
  {
    familyName: "Select",
    publicComponentName: "Select",
    requiredUiExports: ["Select"],
    inspectionSurface: "Select",
    requiredDesignSystemTest: "packages/design-system/src/components/Select.test.tsx",
    requiredUiTest: "packages/ui/src/components/Select.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/composer/components/ComposerMetaBarControls.tsx",
          importSource: "app_design_system",
          requiredImports: ["Select"],
          requiredUsageSnippets: ["<Select"],
        },
        {
          relativePath: "apps/code/src/features/home/components/Home.tsx",
          importSource: "app_design_system",
          requiredImports: ["Select"],
          requiredUsageSnippets: ["<Select"],
        },
        {
          relativePath: "apps/code/src/features/review/components/ReviewPackSurface.tsx",
          importSource: "app_design_system",
          requiredImports: ["Select"],
          requiredUsageSnippets: ["<Select"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/SettingsDisplaySection.tsx",
          importSource: "app_design_system",
          requiredImports: ["Select"],
          requiredUsageSnippets: ["<Select"],
        },
      ],
    },
  },
  {
    familyName: "Popover",
    publicComponentName: "Popover",
    requiredUiExports: ["PopoverSurface", "PopoverMenuItem"],
    inspectionSurface: "Popover",
    requiredDesignSystemTest: "packages/design-system/src/components/Popover.test.tsx",
    requiredUiTest: "packages/ui/src/components/Popover.test.tsx",
    requiredAppCompatTest:
      "apps/code/src/design-system/components/popover/PopoverPrimitives.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/app/components/Sidebar.tsx",
          importSource: "app_design_system",
          requiredImports: ["PopoverSurface", "PopoverMenuItem"],
          requiredUsageSnippets: ["<PopoverSurface", "<PopoverMenuItem"],
        },
        {
          relativePath: "apps/code/src/features/app/components/MainHeader.tsx",
          importSource: "app_design_system",
          requiredImports: ["PopoverSurface"],
          requiredUsageSnippets: ["<PopoverSurface"],
        },
        {
          relativePath: "apps/code/src/features/composer/components/ComposerInput.tsx",
          importSource: "app_design_system",
          requiredImports: ["PopoverSurface"],
          requiredUsageSnippets: ["<PopoverSurface"],
        },
        {
          relativePath: "apps/code/src/features/prompts/components/PromptPanel.tsx",
          importSource: "app_design_system",
          requiredImports: ["PopoverSurface", "PopoverMenuItem"],
          requiredUsageSnippets: ["<PopoverSurface", "<PopoverMenuItem"],
        },
      ],
    },
  },
  {
    familyName: "Dialog",
    publicComponentName: "Dialog",
    requiredUiExports: [
      "Dialog",
      "DialogHeader",
      "DialogTitle",
      "DialogDescription",
      "DialogFooter",
    ],
    inspectionSurface: "Dialog",
    requiredDesignSystemTest: "packages/design-system/src/components/Dialog.test.tsx",
    requiredUiTest: "packages/ui/src/components/Dialog.test.tsx",
    requiredAppCompatTest: "apps/code/src/design-system/components/ModalShell.test.tsx",
    adoption: {
      type: "modal_shell_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/app/components/AppModals.tsx",
          importSource: "app_design_system",
          requiredImports: ["ModalShell"],
          requiredUsageSnippets: ["<ModalShell"],
        },
        {
          relativePath: "apps/code/src/features/home/components/Home.tsx",
          importSource: "app_design_system",
          requiredImports: ["ModalShell"],
          requiredUsageSnippets: ["<ModalShell"],
        },
        {
          relativePath: "apps/code/src/features/workspaces/components/WorktreePrompt.tsx",
          importSource: "app_design_system",
          requiredImports: ["ModalShell"],
          requiredUsageSnippets: ["<ModalShell"],
        },
        {
          relativePath: "apps/code/src/features/mobile/components/MobileServerSetupWizard.tsx",
          importSource: "app_design_system",
          requiredImports: ["ModalShell"],
          requiredUsageSnippets: ["<ModalShell"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/settings-backend-pool/AcpBackendEditorDialog.tsx",
          importSource: "app_design_system",
          requiredImports: ["ModalShell"],
          requiredUsageSnippets: ["<ModalShell"],
        },
      ],
      compatBridge: {
        relativePath: "apps/code/src/design-system/components/ModalShell.tsx",
        importSource: "./modal/ModalPrimitives",
        requiredImports: ["Dialog"],
        requiredUsageSnippets: ["<Dialog"],
      },
    },
  },
  {
    familyName: "Field",
    publicComponentName: "Field",
    requiredUiExports: ["Field"],
    inspectionSurface: "Field",
    requiredDesignSystemTest: "packages/design-system/src/components/Field.test.tsx",
    requiredUiTest: "packages/ui/src/components/Field.test.tsx",
    adoption: {
      type: "shared_embed",
      evidence: [
        {
          relativePath: "packages/design-system/src/components/Input.tsx",
          importSource: "./Field",
          requiredImports: ["Field"],
          requiredUsageSnippets: ["<Field"],
        },
        {
          relativePath: "packages/design-system/src/components/Select.tsx",
          importSource: "./Field",
          requiredImports: ["Field"],
          requiredUsageSnippets: ["<Field"],
        },
        {
          relativePath: "packages/design-system/src/components/Textarea.tsx",
          importSource: "./Field",
          requiredImports: ["Field"],
          requiredUsageSnippets: ["<Field"],
        },
        {
          relativePath: "packages/design-system/src/components/Checkbox.tsx",
          importSource: "./Field",
          requiredImports: ["Field"],
          requiredUsageSnippets: ["<Field"],
        },
        {
          relativePath: "packages/design-system/src/components/Switch.tsx",
          importSource: "./Field",
          requiredImports: ["Field"],
          requiredUsageSnippets: ["<Field"],
        },
        {
          relativePath: "packages/design-system/src/components/RadioGroup.tsx",
          importSource: "./Field",
          requiredImports: ["Field"],
          requiredUsageSnippets: ["<Field"],
        },
      ],
    },
  },
  {
    familyName: "Textarea",
    publicComponentName: "Textarea",
    requiredUiExports: ["Textarea"],
    inspectionSurface: "Textarea",
    requiredDesignSystemTest: "packages/design-system/src/components/Textarea.test.tsx",
    requiredUiTest: "packages/ui/src/components/Textarea.test.tsx",
    requiredAppCompatTest:
      "apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/composer/components/ComposerInput.tsx",
          importSource: "app_design_system",
          requiredImports: ["Textarea"],
          requiredUsageSnippets: ["<Textarea"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/settings-backend-pool/AcpBackendEditorDialog.tsx",
          importSource: "app_design_system",
          requiredImports: ["Textarea"],
          requiredUsageSnippets: ["<Textarea"],
        },
        {
          relativePath: "apps/code/src/features/shared/components/FileEditorCard.tsx",
          importSource: "app_design_system",
          requiredImports: ["Textarea"],
          requiredUsageSnippets: ["<Textarea"],
        },
        {
          relativePath: "apps/code/src/features/git/components/GitDiffPanelModeContent.tsx",
          importSource: "app_design_system",
          requiredImports: ["Textarea"],
          requiredUsageSnippets: ["<Textarea"],
        },
      ],
    },
  },
  {
    familyName: "Rows",
    publicComponentName: "Rows",
    requiredUiExports: ["InlineActionRow", "MetadataList", "MetadataRow"],
    inspectionSurface: "Rows",
    requiredDesignSystemTest: "packages/design-system/src/components/Rows.test.tsx",
    requiredUiTest: "packages/ui/src/components/Rows.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath:
            "apps/code/src/features/design-system/components/DesignSystemClosureFixture.tsx",
          importSource: "app_design_system",
          requiredImports: ["InlineActionRow", "MetadataList", "MetadataRow"],
          requiredUsageSnippets: ["<InlineActionRow", "<MetadataList", "<MetadataRow"],
        },
        {
          relativePath: "apps/code/src/features/git/components/GitDiffPanel.tsx",
          importSource: "app_design_system",
          requiredImports: ["MetadataList", "MetadataRow"],
          requiredUsageSnippets: ["<MetadataList", "<MetadataRow"],
        },
      ],
    },
  },
  {
    familyName: "Badge",
    publicComponentName: "Badge",
    requiredUiExports: ["Badge"],
    inspectionSurface: "Badge",
    requiredDesignSystemTest: "packages/design-system/src/components/Badge.test.tsx",
    requiredUiTest: "packages/ui/src/components/Badge.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/right-panel/RightPanelBlocks.tsx",
          importSource: "app_design_system",
          requiredImports: ["Badge"],
          requiredUsageSnippets: ["<Badge"],
        },
        {
          relativePath:
            "apps/code/src/features/autodrive/components/AutoDriveNavigationFixture.tsx",
          importSource: "app_design_system",
          requiredImports: ["Badge"],
          requiredUsageSnippets: ["<Badge"],
        },
        {
          relativePath: "apps/code/src/features/git/components/GitDiffViewer.tsx",
          importSource: "app_design_system",
          requiredImports: ["Badge"],
          requiredUsageSnippets: ["<Badge"],
        },
      ],
    },
  },
  {
    familyName: "SectionHeader",
    publicComponentName: "SectionHeader",
    requiredUiExports: ["SectionHeader"],
    inspectionSurface: "SectionHeader",
    requiredDesignSystemTest: "packages/design-system/src/components/SectionHeader.test.tsx",
    requiredUiTest: "packages/ui/src/components/SectionHeader.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/home/components/HomeMissionLaunchpadSection.tsx",
          importSource: "app_design_system",
          requiredImports: ["SectionHeader"],
          requiredUsageSnippets: ["<SectionHeader"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/settings-codex-accounts-card/SettingsCodexAccountsSectionHeader.tsx",
          importSource: "app_design_system",
          requiredImports: ["SectionHeader"],
          requiredUsageSnippets: ["<SectionHeader"],
        },
        {
          relativePath:
            "apps/code/src/features/workspaces/components/WorkspaceHomeSubAgentObservabilityFixture.tsx",
          importSource: "app_design_system",
          requiredImports: ["SectionHeader"],
          requiredUsageSnippets: ["<SectionHeader"],
        },
      ],
    },
  },
  {
    familyName: "Text",
    publicComponentName: "Text",
    requiredUiExports: ["Text"],
    inspectionSurface: "Text",
    requiredDesignSystemTest: "packages/design-system/src/components/Text.test.tsx",
    requiredUiTest: "packages/ui/src/components/Text.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/settings/components/SettingsFormChromeFixture.tsx",
          importSource: "app_design_system",
          requiredImports: ["Text"],
          requiredUsageSnippets: ["<Text"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/settings-codex-accounts-card/SettingsCodexHealthTab.tsx",
          importSource: "app_design_system",
          requiredImports: ["Text"],
          requiredUsageSnippets: ["<Text"],
        },
        {
          relativePath:
            "apps/code/src/features/review/components/review-loop/ReviewLoopClosureFixture.tsx",
          importSource: "app_design_system",
          requiredImports: ["Text"],
          requiredUsageSnippets: ["<Text"],
        },
      ],
    },
  },
  {
    familyName: "ListRow",
    publicComponentName: "ListRow",
    requiredUiExports: ["ListRow"],
    inspectionSurface: "ListRow",
    requiredDesignSystemTest: "packages/design-system/src/components/Shell.test.tsx",
    requiredUiTest: "packages/ui/src/components/ListRow.test.tsx",
    adoption: {
      type: "shared_embed",
      evidence: [
        {
          relativePath: "packages/ui/src/components/ListRow.stories.tsx",
          importSource: "../index",
          requiredImports: ["ListRow"],
          requiredUsageSnippets: ["<ListRow"],
        },
      ],
    },
  },
  {
    familyName: "Switch",
    publicComponentName: "Switch",
    requiredUiExports: ["Switch"],
    inspectionSurface: "Switch",
    requiredDesignSystemTest: "packages/design-system/src/components/Switch.test.tsx",
    requiredUiTest: "packages/ui/src/components/Switch.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/SettingsFeaturesSection.tsx",
          importSource: "app_design_system",
          requiredImports: ["Switch"],
          requiredUsageSnippets: ["<Switch"],
        },
        {
          relativePath: "apps/code/src/features/settings/components/SettingsToggleControl.tsx",
          importSource: "app_design_system",
          requiredImports: ["Switch"],
          requiredUsageSnippets: ["<Switch"],
        },
      ],
    },
  },
  {
    familyName: "Shell",
    publicComponentName: "Shell",
    requiredUiExports: ["EmptySurface", "ShellFrame", "ShellSection", "ShellToolbar"],
    inspectionSurface: "Shell",
    requiredDesignSystemTest: "packages/design-system/src/components/Shell.test.tsx",
    requiredUiTest: "packages/ui/src/components/Shell.test.tsx",
    requiredAppCompatTest: "apps/code/src/design-system/components/shell/ShellPrimitives.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/home/components/Home.tsx",
          importSource: "app_design_system",
          requiredImports: ["ShellFrame", "ShellSection"],
          requiredUsageSnippets: ["<ShellFrame", "<ShellSection"],
        },
        {
          relativePath: "apps/code/src/features/home/components/HomeRecentMissionsSection.tsx",
          importSource: "app_design_system",
          requiredImports: ["EmptySurface"],
          requiredUsageSnippets: ["<EmptySurface"],
        },
        {
          relativePath: "apps/code/src/features/composer/components/ComposerShell.tsx",
          importSource: "app_design_system",
          requiredImports: ["ShellFrame", "ShellToolbar"],
          requiredUsageSnippets: ["<ShellFrame", "<ShellToolbar"],
        },
        {
          relativePath: "apps/code/src/features/settings/components/SettingsSectionGrammar.tsx",
          importSource: "app_design_system",
          requiredImports: ["ShellSection"],
          requiredUsageSnippets: ["<ShellSection"],
        },
        {
          relativePath: "apps/code/src/features/app/components/SidebarScaffold.tsx",
          importSource: "app_design_system",
          requiredImports: ["ShellFrame"],
          requiredUsageSnippets: ["<ShellFrame"],
        },
      ],
    },
  },
  {
    familyName: "StatusBadge",
    publicComponentName: "StatusBadge",
    requiredUiExports: ["StatusBadge"],
    inspectionSurface: "StatusBadge",
    requiredDesignSystemTest: "packages/design-system/src/components/StatusBadge.test.tsx",
    requiredUiTest: "packages/ui/src/components/StatusBadge.test.tsx",
    requiredAppCompatTest: "apps/code/src/features/right-panel/RightPanelPrimitives.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/home/components/Home.tsx",
          importSource: "app_design_system",
          requiredImports: ["StatusBadge"],
          requiredUsageSnippets: ["<StatusBadge"],
        },
        {
          relativePath:
            "apps/code/src/features/settings/components/sections/SettingsAutomationSection.tsx",
          importSource: "app_design_system",
          requiredImports: ["StatusBadge"],
          requiredUsageSnippets: ["<StatusBadge"],
        },
      ],
    },
  },
  {
    familyName: "Surface",
    publicComponentName: "Surface",
    requiredUiExports: ["Surface"],
    inspectionSurface: "Surface",
    requiredDesignSystemTest: "packages/design-system/src/components/Surface.test.tsx",
    requiredUiTest: "packages/ui/src/components/Surface.test.tsx",
    adoption: {
      type: "representative_app_surface",
      evidence: [
        {
          relativePath: "apps/code/src/features/home/components/HomeMissionLaunchpadSection.tsx",
          importSource: "app_design_system",
          requiredImports: ["Surface"],
          requiredUsageSnippets: ["<Surface"],
        },
        {
          relativePath: "apps/code/src/features/composer/components/ComposerShell.tsx",
          importSource: "app_design_system",
          requiredImports: ["Surface"],
          requiredUsageSnippets: ["<Surface"],
        },
      ],
    },
  },
];

export const DESIGN_SYSTEM_FAMILY_CONTRACT_MAP = new Map(
  DESIGN_SYSTEM_FAMILY_CONTRACTS.map((family) => [family.publicComponentName, family])
);
