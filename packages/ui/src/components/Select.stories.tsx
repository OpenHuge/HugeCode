import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Select } from "./Select";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "date", label: "Date", disabled: true },
  { value: "elderberry", label: "Elderberry" },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Select
        options={options}
        value={value}
        onChange={setValue}
        placeholder="Select a fruit..."
        className={demoStyles.fixedFieldWidth}
      />
    );
  },
};

export const WithLabel: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Select
        options={options}
        value={value}
        onChange={setValue}
        label="Favorite Fruit"
        placeholder="Select a fruit..."
        className={demoStyles.fixedFieldWidth}
      />
    );
  },
};

export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Select
        options={options}
        value={value}
        onChange={setValue}
        label="Required Field"
        placeholder="Select a fruit..."
        error="Please select a fruit"
        className={demoStyles.fixedFieldWidth}
      />
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <Select
      options={options}
      value="apple"
      label="Disabled Select"
      disabled
      className={demoStyles.fixedFieldWidth}
    />
  ),
};

export const LongLabels: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Select
        options={[
          {
            value: "workspace-default",
            label: "Workspace default backend with review-pack continuity and long placement copy",
          },
          {
            value: "burst-cloud",
            label: "Burst cloud backend with explicit fallback routing and recovery handoff",
          },
        ]}
        value={value}
        onChange={setValue}
        label="Backend"
        placeholder="Choose a backend"
        className={demoStyles.fixedFieldWidth}
      />
    );
  },
};
