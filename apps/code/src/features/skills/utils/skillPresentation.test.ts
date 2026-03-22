import { describe, expect, it } from "vitest";
import type { SkillOption } from "../../../types";
import {
  formatSkillDisplayName,
  normalizeSkillReferenceText,
  splitTextWithSkillReferences,
} from "./skillPresentation";

const SKILLS: SkillOption[] = [
  {
    name: "frontend-design",
    path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
    description: "Create polished frontend interfaces.",
    scope: "global",
    sourceFamily: "codex",
  },
];

describe("skillPresentation", () => {
  it("formats skill ids as readable labels", () => {
    expect(formatSkillDisplayName("frontend-design")).toBe("Frontend Design");
    expect(formatSkillDisplayName("using-superpowers")).toBe("Using Superpowers");
  });

  it("detects markdown skill links as skill references", () => {
    const segments = splitTextWithSkillReferences(
      "Use [$frontend-design](C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md) here.",
      SKILLS
    );

    expect(segments).toEqual([
      { kind: "text", value: "Use " },
      expect.objectContaining({
        kind: "skill",
        referenceName: "frontend-design",
        skill: SKILLS[0],
      }),
      { kind: "text", value: " here." },
    ]);
  });

  it("normalizes markdown skill links into canonical composer mentions", () => {
    const input =
      "[$frontend-design](C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md) ";

    expect(normalizeSkillReferenceText(input, SKILLS, input.length)).toEqual({
      text: "$frontend-design ",
      cursor: "$frontend-design ".length,
    });
  });
});
