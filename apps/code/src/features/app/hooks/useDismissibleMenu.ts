import type { RefObject } from "react";
import { useEffect } from "react";

type UseDismissibleMenuOptions = {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  additionalRefs?: Array<RefObject<HTMLElement | null>>;
  onClose: () => void;
  closeOnEscape?: boolean;
};

export function useDismissibleMenu({
  isOpen,
  containerRef,
  additionalRefs = [],
  onClose,
  closeOnEscape = true,
}: UseDismissibleMenuOptions) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        onClose();
        return;
      }
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (additionalRefs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape || event.key !== "Escape") {
        return;
      }
      onClose();
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [additionalRefs, closeOnEscape, containerRef, isOpen, onClose]);
}
