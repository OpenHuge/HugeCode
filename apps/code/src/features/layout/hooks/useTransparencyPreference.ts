import { useEffect, useState } from "react";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

export function useTransparencyPreference(storageKey = "reduceTransparency") {
  const [reduceTransparency, setReduceTransparency] = useState(() => {
    const stored = readSafeLocalStorageItem(storageKey);
    return stored === "true";
  });

  useEffect(() => {
    writeSafeLocalStorageItem(storageKey, String(reduceTransparency));
  }, [reduceTransparency, storageKey]);

  return {
    reduceTransparency,
    setReduceTransparency,
  };
}
