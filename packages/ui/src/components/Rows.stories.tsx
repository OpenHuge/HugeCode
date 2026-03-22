import type { Meta, StoryObj } from "@storybook/react";
import { Clock3, GitBranch, ShieldCheck } from "lucide-react";
import { InlineActionRow, MetadataList, MetadataRow, StatusBadge } from "../index";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof MetadataList> = {
  title: "Components/Rows",
  component: MetadataList,
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

export const MetadataSummary: Story = {
  render: () => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <MetadataList>
        <MetadataRow label="Launch readiness" value="Nominal after approval grant" />
        <MetadataRow label="Checkpoint age" value="3 minutes" />
        <MetadataRow label="Preferred backend" value="desktop-runtime-us-west" />
        <MetadataRow
          label="Branch status"
          value={
            <span className={demoStyles.row}>
              <GitBranch size={14} />
              `fastcode`
            </span>
          }
        />
      </MetadataList>
    </div>
  ),
};

export const InlineActions: Story = {
  render: () => (
    <div className={demoStyles.stack}>
      <InlineActionRow
        label="Checkpoint replay"
        description="Resume the last verified runtime handoff without rebuilding local shell state."
        action={<Button size="sm">Replay</Button>}
      />
      <InlineActionRow
        label={
          <span className={demoStyles.row}>
            <ShieldCheck size={14} />
            Approval policy
          </span>
        }
        description="One tool call still requires elevated filesystem write access."
        action={<StatusBadge tone="warning">Needs review</StatusBadge>}
      />
      <InlineActionRow
        label={
          <span className={demoStyles.row}>
            <Clock3 size={14} />
            Continuity handoff
          </span>
        }
        description="Keep multiline descriptions readable when action rows are embedded inside narrow shells."
        action={
          <Button variant="ghost" size="sm">
            Open details
          </Button>
        }
      />
    </div>
  ),
};
