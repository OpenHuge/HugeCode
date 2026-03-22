import type { Meta, StoryObj } from "@storybook/react";
import { ChevronDown, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import { PopoverMenuItem, PopoverSurface } from "./Popover";
import * as demoStyles from "./StorybookDemo.css";

const meta = {
  title: "Components/Popover",
  component: PopoverSurface,
  args: {
    children: null,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PopoverSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MenuSurface: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <div className={demoStyles.blockGap}>
        <div className={demoStyles.wrapRow}>
          <Button
            variant={open ? "primary" : "secondary"}
            icon={<ChevronDown aria-hidden />}
            iconPosition="right"
            onClick={() => setOpen((current) => !current)}
          >
            Toggle menu surface
          </Button>
        </div>
        {open ? (
          <PopoverSurface aria-label="Workspace actions" role="menu">
            <PopoverMenuItem active>Open review pack</PopoverMenuItem>
            <PopoverMenuItem icon={<Settings size={14} aria-hidden />}>Settings</PopoverMenuItem>
            <PopoverMenuItem>Inspect continuity</PopoverMenuItem>
          </PopoverSurface>
        ) : null}
      </div>
    );
  },
};

export const PanelSurface: Story = {
  render: () => (
    <PopoverSurface aria-label="Launch readiness" role="dialog">
      <div className={demoStyles.contentBlock}>
        <h3 className={demoStyles.title}>Launch readiness</h3>
        <p className={demoStyles.bodySmall}>
          Overlay panels can hold multiline content and shared section rhythm.
        </p>
      </div>
    </PopoverSurface>
  ),
};
