import type { Meta, StoryObj } from "@storybook/react";
import { Activity, ChevronRight, FolderKanban, RefreshCw, Sparkles } from "lucide-react";
import {
  EmptySurface,
  InlineActionRow,
  MetadataList,
  MetadataRow,
  SectionHeader,
  ShellFrame,
  ShellSection,
  ShellToolbar,
  SplitPanel,
  StatusBadge,
} from "../index";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof ShellFrame> = {
  title: "Components/Shell",
  component: ShellFrame,
  args: {
    children: null,
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceLayout: Story = {
  render: () => (
    <div className={demoStyles.shellCanvas}>
      <ShellToolbar
        leading={<SectionHeader title="Workspace shell" meta="Runtime-backed layout primitives" />}
        trailing={
          <div className={demoStyles.wrapRow}>
            <StatusBadge tone="progress">Streaming</StatusBadge>
            <Button variant="secondary" size="sm">
              Refresh
            </Button>
          </div>
        }
      />
      <ShellFrame>
        <SplitPanel
          className={demoStyles.splitPanelShowcase}
          leading={
            <div className={demoStyles.shellSidebar}>
              <ShellSection
                title="Queues"
                meta="3 active"
                actions={
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                }
              >
                <MetadataList>
                  <MetadataRow label="Planner" value="2 pending reviews" />
                  <MetadataRow label="Runtime" value="1 handoff waiting for approval" />
                  <MetadataRow label="Recoveries" value="Checkpoint replay available" />
                </MetadataList>
              </ShellSection>
              <ShellSection title="Signals" meta="Updated 5s ago">
                <MetadataList>
                  <MetadataRow label="Health" value="Nominal" />
                  <MetadataRow label="Latency" value="94 ms median" />
                </MetadataList>
              </ShellSection>
            </div>
          }
          trailing={
            <div className={demoStyles.shellMain}>
              <ShellSection
                title="Mission continuity"
                meta="Ready for review"
                actions={
                  <div className={demoStyles.wrapRow}>
                    <Button size="sm">Resume</Button>
                    <Button variant="ghost" size="sm">
                      Inspect
                    </Button>
                  </div>
                }
              >
                <div className={demoStyles.stack}>
                  <InlineActionRow
                    label="Checkpoint bundle"
                    description="Published after the last stable tool call."
                    action={
                      <Button variant="secondary" size="sm">
                        <RefreshCw size={14} />
                        Replay
                      </Button>
                    }
                  />
                  <InlineActionRow
                    label="Review notes"
                    description="Design system drift found in empty-state spacing and overlay focus order."
                    action={
                      <Button variant="ghost" size="sm">
                        <ChevronRight size={14} />
                        Open thread
                      </Button>
                    }
                  />
                </div>
              </ShellSection>
              <ShellSection title="Recent activity" meta="Last 15 minutes">
                <MetadataList>
                  <MetadataRow
                    label={
                      <span className={demoStyles.row}>
                        <Sparkles size={14} />
                        Fixture audit
                      </span>
                    }
                    value="Storybook host restored and running across themes."
                  />
                  <MetadataRow
                    label={
                      <span className={demoStyles.row}>
                        <FolderKanban size={14} />
                        Overlay verification
                      </span>
                    }
                    value="Closure fixtures now require user-driven menu and panel triggers."
                  />
                  <MetadataRow
                    label={
                      <span className={demoStyles.row}>
                        <Activity size={14} />
                        Coverage
                      </span>
                    }
                    value="Shell, panel, popover, and form matrices now have dedicated stories."
                  />
                </MetadataList>
              </ShellSection>
            </div>
          }
        />
      </ShellFrame>
    </div>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <EmptySurface
        title="No active mission"
        body="A real host should still provide theme, spacing, and shell context even when the task list is empty."
        icon={<FolderKanban size={18} />}
        actions={
          <div className={demoStyles.wrapRow}>
            <Button size="sm">Start mission</Button>
            <Button variant="ghost" size="sm">
              Open examples
            </Button>
          </div>
        }
      />
    </div>
  ),
};
