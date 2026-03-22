import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./Dialog";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

function DialogExample({
  body,
  confirmLabel = "Confirm",
  triggerLabel,
  triggerVariant,
}: {
  body: string;
  confirmLabel?: string;
  triggerLabel: string;
  triggerVariant?: "destructive";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant={triggerVariant} onClick={() => setOpen(false)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <DialogExample
      triggerLabel="Open dialog"
      body="This fixture verifies the closed-by-default launch path instead of rendering a permanently open modal."
    />
  ),
};

export const Alert: Story = {
  render: () => (
    <DialogExample
      triggerLabel="Delete account"
      triggerVariant="destructive"
      confirmLabel="Delete"
      body="This action permanently removes the account and its related review history."
    />
  ),
};

export const LongBody: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Review handoff
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogHeader>
            <DialogTitle>Review launch readiness</DialogTitle>
            <DialogDescription>
              Long-form approval copy should wrap cleanly and preserve dialog spacing without
              relying on page-local wrapper styles.
            </DialogDescription>
          </DialogHeader>
          <div className={demoStyles.stack}>
            <p className={demoStyles.bodySmall}>
              Route viability remains degraded on the backup remote. The launch path is still
              actionable because the preferred backend has a warm checkpoint, healthy filesystem
              access, and a reviewable diff snapshot.
            </p>
            <p className={demoStyles.bodySmall}>
              Approval pressure is above baseline because one tool call requires escalated write
              access. A real fixture should confirm that focus, spacing, and button hierarchy remain
              stable when explanatory content spans multiple paragraphs.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Later
            </Button>
            <Button onClick={() => setOpen(false)}>Approve resume</Button>
          </DialogFooter>
        </Dialog>
      </>
    );
  },
};
