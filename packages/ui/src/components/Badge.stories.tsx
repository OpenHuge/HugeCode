import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";
import { wrapRow } from "./StorybookDemo.css";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: {
    children: "Ready",
    variant: "default",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <div className={wrapRow}>
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};
