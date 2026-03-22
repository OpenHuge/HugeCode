import type { Meta, StoryObj } from "@storybook/react";
import { Surface } from "../index";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Surface> = {
  title: "Components/Surface",
  component: Surface,
  args: {
    children: null,
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ToneMatrix: Story = {
  render: () => (
    <div className={demoStyles.surfaceMatrix}>
      <Surface className={demoStyles.toneCard} tone="default">
        <strong>Default</strong>
        <span>Primary base surface for cards and panels.</span>
      </Surface>
      <Surface className={demoStyles.toneCard} tone="subtle">
        <strong>Subtle</strong>
        <span>Quiet grouping container for metadata and support content.</span>
      </Surface>
      <Surface className={demoStyles.toneCard} tone="elevated">
        <strong>Elevated</strong>
        <span>Raised emphasis surface for focused work areas.</span>
      </Surface>
      <Surface className={demoStyles.toneCard} tone="translucent">
        <strong>Translucent</strong>
        <span>Overlay-friendly surface that keeps depth cues visible.</span>
      </Surface>
      <Surface className={demoStyles.toneCard} tone="ghost">
        <strong>Ghost</strong>
        <span>Shell frame baseline without an added card effect.</span>
      </Surface>
    </div>
  ),
};

export const ScrollAndOverflow: Story = {
  render: () => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <Surface className={demoStyles.scrollSurface} tone="elevated" padding="lg">
        <div className={demoStyles.stack}>
          <strong>Scrollable content</strong>
          <span>
            This fixture verifies that long operational copy remains readable inside constrained
            shells without relying on private wrapper classes.
          </span>
          <span>
            Runtime health, approval pressure, launch readiness, continuity readiness, and tool
            guardrails should all continue to compose correctly when content grows beyond the first
            viewport.
          </span>
          <span>
            The surface should preserve spacing, border, and background tokens while content
            scrolls.
          </span>
          <span>
            Long review notes, checkpoint summaries, and branch metadata often trigger this state in
            real host shells.
          </span>
        </div>
      </Surface>
    </div>
  ),
};
