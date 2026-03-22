import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";
import { Tooltip } from "./Tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "select",
      options: ["top", "bottom", "left", "right"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div className={demoStyles.centeredSurface}>
        <Story />
      </div>
    ),
  ],
  args: {
    content: "This is a helpful tooltip",
    children: <Button variant="secondary">Hover me</Button>,
    side: "top",
  },
};

export const Bottom: Story = {
  decorators: Default.decorators,
  args: {
    ...Default.args,
    side: "bottom",
  },
};

export const Left: Story = {
  decorators: Default.decorators,
  args: {
    ...Default.args,
    side: "left",
  },
};

export const Right: Story = {
  decorators: Default.decorators,
  args: {
    ...Default.args,
    side: "right",
  },
};
