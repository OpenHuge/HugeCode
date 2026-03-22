import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./Skeleton";
import { blockGap, skeletonAvatar, skeletonCard, wideTextBlock } from "./StorybookDemo.css";

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  args: {
    variant: "rectangular",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rectangular: Story = {
  render: (args) => <Skeleton {...args} className={skeletonCard} />,
};

export const TextLines: Story = {
  render: () => (
    <div className={blockGap}>
      <Skeleton variant="text" className={wideTextBlock} />
      <Skeleton variant="text" className={wideTextBlock} />
      <Skeleton variant="text" />
    </div>
  ),
};

export const Circular: Story = {
  render: () => <Skeleton variant="circular" className={skeletonAvatar} />,
};
