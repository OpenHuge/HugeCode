import type { Meta, StoryObj } from "@storybook/react";
import { Search, Sparkles } from "lucide-react";
import { Card } from "./Card";
import {
  PanelFrame,
  PanelHeader,
  PanelMeta,
  PanelNavItem,
  PanelNavList,
  PanelSearchField,
} from "./Panel";
import * as demoStyles from "./StorybookDemo.css";

const meta = {
  title: "Components/Panel",
  component: PanelFrame,
  args: {
    children: null,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PanelFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <PanelFrame>
      <PanelHeader>
        <div>
          <h3 className={demoStyles.title}>Runtime context</h3>
          <p className={demoStyles.bodySmall}>Supporting metadata and scoped navigation.</p>
        </div>
        <PanelMeta>3 active</PanelMeta>
      </PanelHeader>
      <PanelSearchField
        aria-label="Search panel"
        placeholder="Search files or evidence"
        icon={<Search size={14} aria-hidden />}
      />
      <PanelNavList>
        <PanelNavItem icon={<Sparkles size={14} aria-hidden />} active>
          Review-ready continuity
        </PanelNavItem>
        <PanelNavItem showDisclosure>Fallback route</PanelNavItem>
        <PanelNavItem>Inspector compatibility</PanelNavItem>
      </PanelNavList>
    </PanelFrame>
  ),
};

export const NestedContent: Story = {
  render: () => (
    <PanelFrame>
      <PanelHeader>
        <div>
          <h3 className={demoStyles.title}>Evidence rail</h3>
          <p className={demoStyles.bodySmall}>
            Panels can host composed surfaces, not just nav items.
          </p>
        </div>
        <PanelMeta>Updated now</PanelMeta>
      </PanelHeader>
      <Card>
        <div className={demoStyles.contentBlock}>
          <h4 className={demoStyles.title}>Review Pack</h4>
          <p className={demoStyles.bodySmall}>
            Runtime-published evidence remains grouped and readable.
          </p>
        </div>
      </Card>
    </PanelFrame>
  ),
};
