import {
  readGlobalCodexConfigToml,
  writeGlobalCodexConfigToml,
} from "../../../application/runtime/ports/codexConfig";
import { useFileEditor } from "../../shared/hooks/useFileEditor";

export function useGlobalCodexConfigToml(enabled = true) {
  return useFileEditor({
    key: enabled ? "global-config" : null,
    read: readGlobalCodexConfigToml,
    write: writeGlobalCodexConfigToml,
    readErrorTitle: "Couldn’t load global config.toml",
    writeErrorTitle: "Couldn’t save global config.toml",
  });
}
