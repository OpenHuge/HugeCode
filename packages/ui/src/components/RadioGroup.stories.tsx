import type { Meta, StoryObj } from "@storybook/react";
import { Layers3, MonitorCog, Workflow } from "lucide-react";
import { RadioGroup, type RadioGroupOption } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const options: RadioGroupOption[] = [
  {
    value: "default",
    label: "Default backend",
    description: "Follow the shared runtime preference resolution path.",
    leadingLabel: <Layers3 size={16} aria-hidden />,
  },
  {
    value: "desktop",
    label: "Desktop runtime",
    description: "Prefer the local runtime host when available.",
    leadingLabel: <MonitorCog size={16} aria-hidden />,
  },
  {
    value: "remote",
    label: "Remote backend",
    description: "Pin mission launch to the shared remote execution pool.",
    leadingLabel: <Workflow size={16} aria-hidden />,
  },
];

const meta: Meta<typeof RadioGroup> = {
  title: "Components/Forms/RadioGroup",
  component: RadioGroup,
  args: {
    label: "Backend preference",
    options,
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: "default",
  },
};

export const CardVariant: Story = {
  args: {
    defaultValue: "desktop",
    variant: "card",
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    errorMessage: "Choose a launch target before starting the mission.",
  },
};

export const HorizontalLayout: Story = {
  render: () => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <RadioGroup
        label="Checkpoint scope"
        orientation="horizontal"
        defaultValue="thread"
        options={[
          {
            value: "thread",
            label: "Thread only",
            description: "Recover the active conversation.",
          },
          {
            value: "workspace",
            label: "Workspace",
            description: "Include branch and editor state.",
          },
          { value: "bundle", label: "Bundle", description: "Publish a reusable handoff package." },
        ]}
      />
    </div>
  ),
};
