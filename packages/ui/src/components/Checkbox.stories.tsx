import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Forms/Checkbox",
  component: Checkbox,
  args: {
    label: "Enable automatic checkpoint publishing",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CheckedWithDescription: Story = {
  args: {
    defaultChecked: true,
    description: "Publish a recovery bundle after each verified mission milestone.",
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    errorMessage: "Approval is required before enabling automatic publishing.",
  },
};

export const OverviewMatrix: Story = {
  render: () => (
    <div className={demoStyles.formStack}>
      <Checkbox
        label="Enable automatic checkpoint publishing"
        description="Publish a recovery bundle after each verified mission milestone."
      />
      <Checkbox
        defaultChecked
        label="Sync branch metadata into launch readiness"
        description="Expose branch and backend drift inside the runtime preflight summary."
      />
      <Checkbox
        indeterminate
        label="Review inherited approvals"
        description="A mixed state is useful when some environments inherit policy and others do not."
      />
      <Checkbox
        invalid
        label="Bypass guardrails"
        errorMessage="This action must remain blocked until policy review completes."
      />
    </div>
  ),
};
