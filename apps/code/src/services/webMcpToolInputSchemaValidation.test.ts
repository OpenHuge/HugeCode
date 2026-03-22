import { describe, expect, it } from "vitest";
import { validateToolInputAgainstSchema } from "./webMcpToolInputSchemaValidation";

describe("validateToolInputAgainstSchema", () => {
  it("reports missing required fields", () => {
    const result = validateToolInputAgainstSchema(
      { path: "apps/code/src/main.tsx" },
      {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      }
    );

    expect(result.missingRequired).toEqual(["content"]);
    expect(result.errors).toContain("Missing required field: content");
  });

  it("reports type mismatches", () => {
    const result = validateToolInputAgainstSchema(
      {
        timeoutMs: "5000",
        includeHidden: "false",
      },
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number" },
          includeHidden: { type: "boolean" },
        },
      }
    );

    expect(result.typeMismatches).toEqual(
      expect.arrayContaining([
        "Invalid field type at timeoutMs: expected number, received string.",
        "Invalid field type at includeHidden: expected boolean, received string.",
      ])
    );
    expect(result.errors).toEqual(expect.arrayContaining(result.typeMismatches));
  });

  it("reports enum mismatches", () => {
    const result = validateToolInputAgainstSchema(
      {
        stepKind: "bash",
      },
      {
        type: "object",
        properties: {
          stepKind: { type: "string", enum: ["read", "write"] },
        },
      }
    );

    expect(result.typeMismatches).toContain(
      "Invalid enum value at stepKind: expected one of read, write, received bash."
    );
    expect(result.errors).toContain(
      "Invalid enum value at stepKind: expected one of read, write, received bash."
    );
  });

  it("supports oneOf for string or array<string>", () => {
    const schema = {
      type: "object",
      properties: {
        includeGlobs: {
          oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
        },
      },
    };
    const stringInput = validateToolInputAgainstSchema({ includeGlobs: "**/*.ts" }, schema);
    const arrayInput = validateToolInputAgainstSchema({ includeGlobs: ["**/*.ts"] }, schema);
    const invalidInput = validateToolInputAgainstSchema({ includeGlobs: 100 }, schema);

    expect(stringInput.errors).toHaveLength(0);
    expect(arrayInput.errors).toHaveLength(0);
    expect(invalidInput.errors).toContain(
      "Invalid field value at includeGlobs: value does not match any allowed schema variant."
    );
  });

  it("reports extra fields as warnings without errors", () => {
    const result = validateToolInputAgainstSchema(
      {
        command: "pnpm -C apps/code typecheck",
        unexpected: true,
      },
      {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      }
    );

    expect(result.extraFields).toEqual(["unexpected"]);
    expect(result.warnings).toContain("Unexpected field: unexpected");
    expect(result.errors).toHaveLength(0);
  });

  it("fails when root value is not an object", () => {
    const result = validateToolInputAgainstSchema([], {
      type: "object",
      properties: {
        path: { type: "string" },
      },
    });

    expect(result.errors).toContain("Invalid root type: expected object, received array.");
    expect(result.typeMismatches).toContain("Invalid root type: expected object, received array.");
  });
});
