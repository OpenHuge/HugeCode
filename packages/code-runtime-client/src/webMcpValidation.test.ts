import { describe, expect, it } from "vitest";
import {
  extractSchemaValidationResult,
  WebMcpInputSchemaValidationError,
} from "./webMcpInputSchemaValidationError";
import { validateWebMcpCreateMessageInput } from "./webMcpModelInputSchemas";
import { validateToolInputAgainstSchema } from "./webMcpToolInputSchemaValidation";

describe("@ku0/code-runtime-client web mcp validation", () => {
  it("reports missing required fields from schema validation", () => {
    const validation = validateWebMcpCreateMessageInput({
      messages: [],
    });

    expect(validation.missingRequired).toEqual(["maxTokens"]);
    expect(validation.errors).toContain("Missing required field: maxTokens");
  });

  it("extracts structured validation details from the canonical error type", () => {
    const validation = validateToolInputAgainstSchema(
      { mode: "url", message: "test" },
      {
        type: "object",
        properties: {
          mode: { type: "string" },
          message: { type: "string" },
          url: { type: "string" },
        },
        required: ["mode", "message", "url"],
      }
    );

    const error = new WebMcpInputSchemaValidationError({
      toolName: "webmcp.create_message",
      scope: "runtime",
      validation,
    });

    expect(extractSchemaValidationResult(error)).toEqual(validation);
  });
});
