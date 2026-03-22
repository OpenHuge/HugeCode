import type { Meta, StoryObj } from "@storybook/react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "ghost",
        "destructive",
        "soft",
        "outline",
        "subtle",
        "danger",
        "danger-ghost",
        "destructive-ghost",
      ],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "icon"],
    },
    loading: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Button",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Button",
  },
};

export const Soft: Story = {
  args: {
    variant: "soft",
    children: "Button",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Loading",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled",
  },
};

export const WithLeadingIcon: Story = {
  args: {
    children: "Continue",
    icon: <Check aria-hidden />,
    iconPosition: "left",
  },
};

export const WithTrailingIcon: Story = {
  args: {
    children: "Continue",
    icon: <ArrowRight aria-hidden />,
    iconPosition: "right",
  },
};

export const CoverageMatrix: Story = {
  render: () => (
    <div className={demoStyles.blockGap}>
      <div className={demoStyles.wrapRow}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="soft">Soft</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="subtle">Subtle</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="danger-ghost">Danger Ghost</Button>
      </div>
      <div className={demoStyles.wrapRow}>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Confirm" icon={<Check aria-hidden />} />
      </div>
      <div className={demoStyles.wrapRow}>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button icon={<Check aria-hidden />}>With icon</Button>
        <Button icon={<ArrowRight aria-hidden />} iconPosition="right">
          Trailing icon
        </Button>
      </div>
    </div>
  ),
};
