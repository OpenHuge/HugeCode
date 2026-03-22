import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./Textarea";
import * as demoStyles from "./StorybookDemo.css";

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  args: {
    label: "Project brief",
    placeholder: "Describe the interaction, constraints, and expected tone...",
    helperText: "This copy appears below the field when there is no error.",
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ErrorState: Story = {
  args: {
    error: "A brief is required before continuing.",
    helperText: undefined,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "This textarea is rendered in a disabled review state.",
  },
};

export const LongForm: Story = {
  render: () => (
    <div className={demoStyles.wideTextBlock}>
      <Textarea
        label="Design review note"
        helperText="Multiline copy should stay legible across longer review notes."
        defaultValue={[
          "1. Validate shared token usage against the active theme contract.",
          "2. Confirm fixture host parity with the real workspace shell.",
          "3. Remove wrapper-only samples that cannot prove real integration behavior.",
        ].join("\n")}
      />
    </div>
  ),
};
