import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Save from "lucide-react/dist/esm/icons/save";
import type { ReactNode } from "react";
import { Button, Textarea } from "../../../design-system";

type FileEditorCardClassNames = {
  container: string;
  header: string;
  title: string;
  actions: string;
  meta: string;
  iconButton: string;
  error: string;
  textareaField?: string;
  textarea: string;
  help: string;
};

type FileEditorCardProps = {
  title: string;
  meta?: string;
  error?: string | null;
  value: string;
  placeholder?: string;
  helpText?: ReactNode;
  disabled?: boolean;
  refreshDisabled?: boolean;
  saveDisabled?: boolean;
  saveLabel: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  classNames: FileEditorCardClassNames;
};

export function FileEditorCard({
  title,
  meta,
  error,
  value,
  placeholder,
  helpText,
  disabled,
  refreshDisabled,
  saveDisabled,
  saveLabel,
  onChange,
  onRefresh,
  onSave,
  classNames,
}: FileEditorCardProps) {
  return (
    <div className={classNames.container}>
      <div className={classNames.header}>
        <div className={classNames.title}>{title}</div>
        <div className={classNames.actions}>
          {meta ? <div className={classNames.meta}>{meta}</div> : null}
          <Button
            variant="ghost"
            size="sm"
            className={classNames.iconButton}
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label={`Refresh ${title}`}
            title="Refresh"
          >
            <RefreshCw aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={classNames.iconButton}
            onClick={onSave}
            disabled={saveDisabled}
            aria-label={saveLabel === "Create" ? `Create ${title}` : `Save ${title}`}
            title={saveLabel}
          >
            <Save aria-hidden />
          </Button>
        </div>
      </div>
      {error ? <div className={classNames.error}>{error}</div> : null}
      <Textarea
        className={classNames.textarea}
        fieldClassName={classNames.textareaField}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        disabled={disabled}
        textareaSize="lg"
      />
      {helpText ? <div className={classNames.help}>{helpText}</div> : null}
    </div>
  );
}
