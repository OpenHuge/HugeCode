import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Activity, ChevronRight, Clock3, ShieldCheck } from "lucide-react";
import { ListRow, StatusBadge } from "../index";
import * as demoStyles from "./StorybookDemo.css";

type ListRowPreviewProps = {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  interactive?: boolean;
};

function ListRowPreview({
  description,
  interactive = false,
  leading,
  title,
  trailing,
}: ListRowPreviewProps) {
  if (interactive) {
    return (
      <ListRow
        title={title}
        description={description}
        leading={leading}
        trailing={trailing}
        onClick={() => undefined}
      />
    );
  }

  return <ListRow title={title} description={description} leading={leading} trailing={trailing} />;
}

const meta = {
  title: "Components/Lists/ListRow",
  component: ListRowPreview,
  args: {
    title: "Runtime handoff",
    description: "Last checkpoint replay is ready for review.",
  },
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ListRowPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaticRow: Story = {
  args: {
    leading: <Activity size={16} aria-hidden />,
    trailing: <StatusBadge tone="progress">Healthy</StatusBadge>,
  },
};

export const InteractiveRow: Story = {
  render: (args) => (
    <div className={demoStyles.fixedWidePanelWidth}>
      <ListRowPreview
        {...args}
        interactive
        leading={<ShieldCheck size={16} aria-hidden />}
        trailing={<ChevronRight size={16} aria-hidden />}
      />
    </div>
  ),
};

export const QueuePreview: Story = {
  render: () => (
    <div className={demoStyles.listColumn}>
      <ListRow
        title="Launch readiness"
        description="Nominal after approval pressure is cleared."
        leading={<Activity size={16} aria-hidden />}
        trailing={<StatusBadge tone="progress">Ready</StatusBadge>}
      />
      <ListRow
        title="Checkpoint replay"
        description="Latest recovery bundle published 3 minutes ago."
        leading={<Clock3 size={16} aria-hidden />}
        trailing={<ChevronRight size={16} aria-hidden />}
        onClick={() => undefined}
      />
      <ListRow
        title="Policy review"
        description="One elevated filesystem request still needs approval."
        leading={<ShieldCheck size={16} aria-hidden />}
        trailing={<StatusBadge tone="warning">Needs review</StatusBadge>}
        onClick={() => undefined}
      />
    </div>
  ),
};
