import type { Meta, StoryObj } from "@storybook/react";
import { Field, Input, Textarea } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Field> = {
  title: "Components/Forms/Field",
  component: Field,
  args: {
    label: "Mission title",
    htmlFor: "storybook-field-input",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InputField: Story = {
  render: (args) => (
    <div className={demoStyles.fixedFieldWidth}>
      <Field {...args} description="Short, operator-facing label shown in the workspace rail.">
        <Input id="storybook-field-input" placeholder="Improve shared Storybook surface" />
      </Field>
    </div>
  ),
};

export const FieldWithError: Story = {
  render: (args) => (
    <div className={demoStyles.fixedFieldWidth}>
      <Field
        {...args}
        htmlFor="storybook-field-error"
        errorMessage="Mission title must stay under 80 characters."
      >
        <Input
          id="storybook-field-error"
          aria-invalid="true"
          defaultValue="This title is intentionally much too long for the current constraint"
        />
      </Field>
    </div>
  ),
};

export const TextareaField: Story = {
  render: () => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <Field
        label="Review summary"
        htmlFor="storybook-field-textarea"
        description="Use description and error slots to keep copy paired with the control."
      >
        <Textarea
          id="storybook-field-textarea"
          rows={5}
          defaultValue="The public component layer now exposes stable primitives that were previously only visible through the design-system package."
        />
      </Field>
    </div>
  ),
};
