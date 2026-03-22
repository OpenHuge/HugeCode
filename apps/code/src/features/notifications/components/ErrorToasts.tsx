import X from "lucide-react/dist/esm/icons/x";
import type { ErrorToast } from "../../../application/runtime/ports/toasts";
import { Button } from "../../../design-system";
import {
  ToastActions,
  ToastBody,
  ToastCard,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "../../../design-system";

type ErrorToastsProps = {
  toasts: ErrorToast[];
  onDismiss: (id: string) => void;
};

export function ErrorToasts({ toasts, onDismiss }: ErrorToastsProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <ToastViewport className="error-toasts" role="region" ariaLive="assertive">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} tone="error" className="error-toast" role="alert">
          <ToastHeader className="error-toast-header">
            <ToastTitle className="error-toast-title">{toast.title}</ToastTitle>
            <ToastActions className="error-toast-actions">
              <Button
                variant="ghost"
                size="icon"
                className="error-toast-dismiss"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss error"
                title="Dismiss"
              >
                <X size={14} aria-hidden />
              </Button>
            </ToastActions>
          </ToastHeader>
          <ToastBody className="error-toast-body">{toast.message}</ToastBody>
        </ToastCard>
      ))}
    </ToastViewport>
  );
}
