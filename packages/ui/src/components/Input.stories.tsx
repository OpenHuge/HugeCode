import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number"],
    },
    disabled: {
      control: "boolean",
    },
    required: {
      control: "boolean",
    },
    inputSize: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Email",
    type: "email",
    placeholder: "you@example.com",
  },
};

export const WithError: Story = {
  args: {
    label: "Password",
    type: "password",
    error: "Password must be at least 8 characters",
    value: "short",
  },
};

export const WithHelper: Story = {
  args: {
    label: "Username",
    helperText: "This will be your public display name",
    placeholder: "johndoe",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled Input",
    disabled: true,
    value: "Cannot edit this",
  },
};

export const Required: Story = {
  args: {
    label: "Required Field",
    required: true,
    placeholder: "This field is required",
  },
};

export const LongValue: Story = {
  args: {
    label: "Workspace Path",
    value: "/Users/han/Documents/Code/ParallelUI/UI-keep-up/packages/design-system/src/components",
    readOnly: true,
  },
};

export const CoverageMatrix: Story = {
  render: () => (
    <div className={demoStyles.blockGap}>
      <Input label="Small" inputSize="sm" placeholder="Small field" />
      <Input label="Medium" inputSize="md" placeholder="Medium field" helperText="Helper copy" />
      <Input label="Large" inputSize="lg" placeholder="Large field" />
      <Input
        label="Error"
        inputSize="md"
        error="Field validation failed for the current value."
        value="bad-value"
      />
      <Input label="Disabled" inputSize="md" disabled value="Read-only snapshot for acceptance" />
    </div>
  ),
};
