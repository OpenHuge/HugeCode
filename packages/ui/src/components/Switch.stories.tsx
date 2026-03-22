import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Switch> = {
  title: "Components/Forms/Switch",
  component: Switch,
  args: {
    label: "Enable continuity publishing",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Enabled: Story = {
  args: {
    defaultChecked: true,
    description: "Keep recovery checkpoints available after launch.",
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    errorMessage: "Publishing cannot be enabled until a storage target is configured.",
  },
};

export const SettingsPreview: Story = {
  render: () => (
    <div className={demoStyles.formStack}>
      <Switch
        defaultChecked
        label="Enable continuity publishing"
        description="Store handoff checkpoints after each verified tool call."
      />
      <Switch
        label="Mirror mission metadata into the shell"
        description="Expose launch readiness and backend drift in shared chrome."
      />
      <Switch
        disabled
        label="Allow guardrail bypass"
        description="This setting remains locked by organization policy."
      />
    </div>
  ),
};
