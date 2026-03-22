import {
  type AriaRole,
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  ToastActions as SharedToastActions,
  ToastBody as SharedToastBody,
  ToastCard as SharedToastCard,
  ToastError as SharedToastError,
  ToastHeader as SharedToastHeader,
  type ToastTone,
  ToastTitle as SharedToastTitle,
  ToastViewport as SharedToastViewport,
} from "@ku0/design-system";
import { cn } from "../lib/utils";
import * as styles from "./Toast.styles.css";

export type ToastType = ToastTone;

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <SharedToastCard
      className={cn(styles.toastBase, styles.toastVariants[toast.type])}
      role="alert"
      tone={toast.type}
    >
      <span className={styles.icon}>{icons[toast.type]}</span>
      <div className={styles.content}>
        <SharedToastTitle className={styles.title}>{toast.title}</SharedToastTitle>
        {toast.description ? (
          <SharedToastBody className={styles.description}>{toast.description}</SharedToastBody>
        ) : null}
      </div>
      <button type="button" onClick={onClose} className={styles.closeButton} aria-label="关闭通知">
        ✕
      </button>
    </SharedToastCard>
  );
}

type ToastViewportProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "role"> & {
  children: ReactNode;
  className?: string;
  role?: AriaRole;
  ariaLive?: "off" | "polite" | "assertive";
};

export function ToastViewport({
  children,
  className,
  role,
  ariaLive,
  ...props
}: ToastViewportProps) {
  return (
    <SharedToastViewport
      className={cn(styles.viewport, className)}
      role={role}
      ariaLive={ariaLive}
      {...props}
    >
      {children}
    </SharedToastViewport>
  );
}

type ToastCardProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "role"> & {
  children: ReactNode;
  className?: string;
  role?: AriaRole;
  type?: ToastType;
};

export function ToastCard({ children, className, role, type = "info", ...props }: ToastCardProps) {
  return (
    <SharedToastCard
      className={cn(styles.card, styles.toastVariants[type], className)}
      role={role}
      tone={type}
      {...props}
    >
      {children}
    </SharedToastCard>
  );
}

type ToastSectionProps = ComponentPropsWithoutRef<"div">;

export function ToastHeader({ className, ...props }: ToastSectionProps) {
  return <SharedToastHeader className={cn(styles.header, className)} {...props} />;
}

export function ToastActions({ className, ...props }: ToastSectionProps) {
  return <SharedToastActions className={cn(styles.actions, className)} {...props} />;
}

type ToastTextProps = ComponentPropsWithoutRef<"div">;

export function ToastTitle({ className, ...props }: ToastTextProps) {
  return <SharedToastTitle className={cn(styles.title, className)} {...props} />;
}

export function ToastBody({ className, ...props }: ToastTextProps) {
  return <SharedToastBody className={cn(styles.description, className)} {...props} />;
}

type ToastErrorProps = ComponentPropsWithoutRef<"pre">;

export function ToastError({ className, ...props }: ToastErrorProps) {
  return <SharedToastError className={cn(styles.error, className)} {...props} />;
}
