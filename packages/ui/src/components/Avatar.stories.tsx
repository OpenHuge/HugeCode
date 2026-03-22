import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "./Avatar";

const avatarDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23111827'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%2394a3b8'/%3E%3Cpath d='M14 54c4-10 14-16 18-16s14 6 18 16' fill='%23cbd5e1'/%3E%3C/svg%3E";

const meta: Meta<typeof Avatar> = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    src: {
      control: "text",
    },
    fallback: {
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {
    fallback: "A",
  },
};

export const WithImage: Story = {
  args: {
    src: avatarDataUrl,
    fallback: "LT",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    fallback: "S",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    fallback: "L",
  },
};
