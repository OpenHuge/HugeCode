import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";
import * as demoStyles from "./StorybookDemo.css";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["elevated", "flat", "interactive"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className={demoStyles.contentBlock}>
        <h3 className={demoStyles.title}>Card Title</h3>
        <p className={demoStyles.body}>This is a basic card component with default styling.</p>
      </div>
    ),
  },
};

export const Elevated: Story = {
  args: {
    variant: "elevated",
    children: (
      <div className={demoStyles.contentBlock}>
        <h3 className={demoStyles.title}>Elevated Card</h3>
        <p className={demoStyles.body}>This card has a shadow to appear elevated.</p>
      </div>
    ),
  },
};

export const Flat: Story = {
  args: {
    variant: "flat",
    children: (
      <div className={demoStyles.contentBlock}>
        <h3 className={demoStyles.title}>Flat Card</h3>
        <p className={demoStyles.body}>This card has no shadow for a flat appearance.</p>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: "interactive",
    children: (
      <div className={demoStyles.contentBlock}>
        <h3 className={demoStyles.title}>Interactive Card</h3>
        <p className={demoStyles.body}>This card responds to hover interactions.</p>
      </div>
    ),
  },
};

export const WithContent: Story = {
  render: () => (
    <Card className={demoStyles.fixedCardWidth}>
      <div className={demoStyles.contentBlock}>
        <div className={demoStyles.row}>
          <div className={demoStyles.avatarChip}>
            <span>JD</span>
          </div>
          <div>
            <h3 className={demoStyles.title}>John Doe</h3>
            <p className={demoStyles.bodySmall}>Software Engineer</p>
          </div>
        </div>
        <p className={demoStyles.body}>
          Building amazing user interfaces with modern technologies.
        </p>
      </div>
    </Card>
  ),
};
