import type { Meta, StoryObj } from "@storybook/react";
import { SectionHeader, StatusBadge } from "../index";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof SectionHeader> = {
  title: "Components/SectionHeader",
  component: SectionHeader,
  args: {
    title: "Runtime review",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    meta: "Updated 12 seconds ago",
    actions: <Button size="sm">Inspect</Button>,
  },
};

export const LongMeta: Story = {
  render: () => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <SectionHeader
        title="Checkpoint publication"
        meta="This header fixture verifies that long review metadata wraps without collapsing actions or relying on page-local shell wrappers."
        actions={
          <div className={demoStyles.wrapRow}>
            <StatusBadge tone="progress">Streaming</StatusBadge>
            <Button variant="ghost" size="sm">
              View trace
            </Button>
          </div>
        }
      />
    </div>
  ),
};
