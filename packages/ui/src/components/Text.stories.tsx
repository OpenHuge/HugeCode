import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Text> = {
  title: "Components/Content/Text",
  component: Text,
  args: {
    children: "Shared UI text contract",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const scaleOrder = [
  "nano",
  "tiny",
  "micro",
  "fine",
  "label",
  "meta",
  "ui",
  "chrome",
  "chat",
  "content",
  "title",
  "titleLg",
  "displaySm",
  "display",
  "displayLg",
] as const;

export const Scale: Story = {
  render: () => (
    <div className={demoStyles.textScaleStack}>
      {scaleOrder.map((size) => (
        <div key={size} className={demoStyles.textScaleRow}>
          <Text size="nano" tone="muted" monospace>
            {size}
          </Text>
          <Text as="span" size={size}>
            Public text tokens stay aligned across shared surfaces.
          </Text>
        </div>
      ))}
    </div>
  ),
};

export const ToneAndWeight: Story = {
  render: () => (
    <div className={demoStyles.stack}>
      <Text size="content" tone="default">
        Default content tone
      </Text>
      <Text size="content" tone="muted">
        Muted supporting tone
      </Text>
      <Text size="content" tone="strong" weight="semibold">
        Strong emphasis for primary information
      </Text>
      <Text size="meta" tone="success" weight="medium">
        Healthy runtime signal
      </Text>
      <Text size="meta" tone="warning" weight="medium">
        Review still required
      </Text>
      <Text size="meta" tone="danger" weight="medium">
        Guardrail breach detected
      </Text>
      <Text size="label" monospace>
        mission_id = continuity-replay-42
      </Text>
    </div>
  ),
};

export const Truncation: Story = {
  render: () => (
    <div className={demoStyles.fixedFieldWidth}>
      <Text as="div" size="meta" truncate>
        Remote execution backend drift requires a manual review before launch readiness can return
        to nominal.
      </Text>
    </div>
  ),
};
