import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import * as demoStyles from "./StorybookDemo.css";
import {
  ToastActions,
  ToastBody,
  ToastCard,
  ToastError,
  ToastHeader,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  useToast,
} from "./Toast";

const ToastDemo = () => {
  const { addToast } = useToast();

  return (
    <div className={demoStyles.wrapRow}>
      <Button
        variant="secondary"
        onClick={() => addToast({ title: "Operation successful", type: "success" })}
      >
        Success Toast
      </Button>
      <Button
        variant="destructive"
        onClick={() => addToast({ title: "An error occurred", type: "error" })}
      >
        Error Toast
      </Button>
      <Button variant="outline" onClick={() => addToast({ title: "Please note", type: "warning" })}>
        Warning Toast
      </Button>
      <Button
        variant="ghost"
        onClick={() => addToast({ title: "New message received", type: "info" })}
      >
        Info Toast
      </Button>
    </div>
  );
};

const meta: Meta<typeof ToastProvider> = {
  title: "Components/Toast",
  component: ToastProvider,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className={demoStyles.paddedSurface}>
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ToastProvider>;

export const Default: Story = {
  render: () => <ToastDemo />,
};

export const LongDescription: Story = {
  render: () => {
    const LongToastDemo = () => {
      const { addToast } = useToast();

      return (
        <Button
          onClick={() =>
            addToast({
              title: "Checkpoint requires review",
              description:
                "The publish handoff contains a long-form summary of branch state, runtime readiness, and approval pressure so this fixture can verify multiline wrapping inside the real toast provider.",
              type: "warning",
            })
          }
        >
          Trigger long toast
        </Button>
      );
    };

    return <LongToastDemo />;
  },
};

export const ComposedCard: Story = {
  render: () => (
    <ToastViewport>
      <ToastCard type="error">
        <ToastHeader>
          <ToastTitle>Runtime connection dropped</ToastTitle>
        </ToastHeader>
        <ToastBody>
          The active remote backend stopped streaming before checkpoint publication completed.
        </ToastBody>
        <ToastError>
          ECONNRESET: connection closed before final diff snapshot was emitted
        </ToastError>
        <ToastActions>
          <Button variant="ghost" size="sm">
            Dismiss
          </Button>
          <Button size="sm">Reconnect</Button>
        </ToastActions>
      </ToastCard>
    </ToastViewport>
  ),
};
