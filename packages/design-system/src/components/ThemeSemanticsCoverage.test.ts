import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";

const componentCoverage = [
  ["Card.css.ts", "card"],
  ["Dialog.css.ts", "dialog"],
  ["EmptyState.css.ts", "emptyState"],
  ["Field.css.ts", "field"],
  ["RadioGroup.css.ts", "radioGroup"],
  ["Rows.css.ts", "rows"],
  ["SectionHeader.css.ts", "sectionHeader"],
  ["Shell.css.ts", "surface"],
  ["SplitPanel.css.ts", "surface"],
  ["Surface.css.ts", "surface"],
  ["Switch.css.ts", "switch"],
  ["Textarea.css.ts", "textarea"],
] as const;

describe("shared component theme semantics coverage", () => {
  it.each(componentCoverage)(
    "sources %s fallback tokens from component theme semantics",
    (fileName, familyKey) => {
      const source = readDesignSystemSource(`components/${fileName}`);

      expect(source).toContain('from "../themeSemantics"');
      expect(source).toContain(`componentThemeVars.${familyKey}`);
    }
  );
});
