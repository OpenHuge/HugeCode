import { Button } from "@heroui/react";
import { Chrome, Download, FileUp } from "lucide-react";

type T3BrowserStaticDataActionsProps = {
  busy: boolean;
  onExport: () => void;
  onExportToChrome: () => void;
  onImportClick: () => void;
};

export function T3BrowserStaticDataActions({
  busy,
  onExport,
  onExportToChrome,
  onImportClick,
}: T3BrowserStaticDataActionsProps) {
  return (
    <div className="t3-browser-static-data-actions">
      <Button
        type="button"
        onPress={() => {
          if (!busy) {
            onExport();
          }
        }}
        aria-disabled={busy}
        size="sm"
        variant="outline"
      >
        <Download size={13} />
        Export encrypted data
      </Button>
      <Button
        type="button"
        onPress={() => {
          if (!busy) {
            onExportToChrome();
          }
        }}
        aria-disabled={busy}
        size="sm"
        variant="outline"
      >
        <Chrome size={13} />
        Export to Chrome
      </Button>
      <Button
        type="button"
        onPress={() => {
          if (!busy) {
            onImportClick();
          }
        }}
        aria-disabled={busy}
        size="sm"
        variant="outline"
      >
        <FileUp size={13} />
        Import data
      </Button>
    </div>
  );
}
