import type { Meta, StoryObj } from "@storybook/react";
import { Activity, Shield } from "lucide-react";
import { Icon } from "./Icon";
import * as demoStyles from "./StorybookDemo.css";

const meta = {
  title: "Components/Icon",
  component: Icon,
  args: {
    icon: Activity,
    size: "md",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SizeMatrix: Story = {
  render: () => (
    <div className={demoStyles.wrapRow}>
      <Icon icon={Activity} size="xs" />
      <Icon icon={Activity} size="sm" />
      <Icon icon={Activity} size="md" />
      <Icon icon={Activity} size="lg" />
      <Icon icon={Shield} size="xl" />
    </div>
  ),
};
