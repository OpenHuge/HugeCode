import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof StatusBadge> = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  args: {
    children: "Ready",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ToneMatrix: Story = {
  render: () => (
    <div className={demoStyles.badgeWrap}>
      <StatusBadge tone="default">Idle</StatusBadge>
      <StatusBadge tone="progress">Syncing</StatusBadge>
      <StatusBadge tone="success">Published</StatusBadge>
      <StatusBadge tone="warning">Needs review</StatusBadge>
      <StatusBadge tone="error">Blocked</StatusBadge>
    </div>
  ),
};
