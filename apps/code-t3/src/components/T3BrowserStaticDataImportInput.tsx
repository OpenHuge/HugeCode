import type { RefObject } from "react";

type T3BrowserStaticDataImportInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onImport: (file: File) => void;
};

export function T3BrowserStaticDataImportInput({
  inputRef,
  onImport,
}: T3BrowserStaticDataImportInputProps) {
  return (
    <input
      ref={inputRef}
      className="t3-browser-static-data-input"
      type="file"
      accept=".hcbrowser,application/json"
      aria-label="Import portable browser account data file"
      onChange={(event) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = "";
        if (file) {
          onImport(file);
        }
      }}
    />
  );
}
