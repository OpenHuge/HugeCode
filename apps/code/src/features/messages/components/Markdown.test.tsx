/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

const clipboardWriteTextMock = vi.fn<Promise<void>, [string]>();

afterEach(() => {
  cleanup();
  clipboardWriteTextMock.mockReset();
});

Object.defineProperty(globalThis.navigator, "clipboard", {
  value: {
    writeText: clipboardWriteTextMock,
  },
  configurable: true,
});

describe("Markdown", () => {
  it("uses a non-submit copy button for code blocks", async () => {
    clipboardWriteTextMock.mockResolvedValue(undefined);

    render(<Markdown value={"```ts\nconst value = 1;\n```"} codeBlockStyle="message" />);

    const copyButton = screen.getByRole("button", { name: "Copy code block" });
    expect((copyButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("```ts\nconst value = 1;\n```");
    });
  });

  it("keeps file-link pills on muted chip chrome instead of gradient capsules", () => {
    const source = readFileSync(resolve(import.meta.dirname, "Markdown.styles.css.ts"), "utf8");

    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 94%, transparent), color-mix(in srgb, var(--ds-surface-control) 66%, transparent))"
    );
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-hover) 88%, transparent), color-mix(in srgb, var(--ds-surface-control) 78%, transparent))"
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 2px color-mix(in srgb, var(--ds-brand-primary) 16%, transparent)"'
    );
  });

  it("keeps syntax highlighting inside design-system tokens instead of importing a vendor theme", () => {
    const componentSource = readFileSync(resolve(import.meta.dirname, "Markdown.tsx"), "utf8");
    const stylesSource = readFileSync(
      resolve(import.meta.dirname, "Markdown.styles.css.ts"),
      "utf8"
    );

    expect(componentSource).not.toContain("prismjs/themes/prism-tomorrow.css");
    expect(stylesSource).toContain("var(--ds-syntax-keyword)");
    expect(stylesSource).toContain("var(--ds-syntax-function)");
    expect(stylesSource).toContain("var(--ds-syntax-success)");
  });

  it("renders skill references as inline entities with hover details", async () => {
    render(
      <Markdown
        value="Use $Using Superpowers before editing."
        skills={[
          {
            name: "Using Superpowers",
            path: "/Users/han/.codex/superpowers/skills/using-superpowers/SKILL.md",
            description:
              "Use when starting any conversation - establishes how to find and use skills.",
            scope: "global",
            sourceFamily: "codex",
          },
        ]}
      />
    );

    expect(screen.queryByText("$Using Superpowers")).toBeNull();

    const trigger = screen.getByText("Using Superpowers").closest('[data-family="tooltip"]');
    expect(trigger).not.toBeNull();

    fireEvent.mouseEnter(trigger as Element);

    expect(
      await screen.findByText(
        "Use when starting any conversation - establishes how to find and use skills."
      )
    ).not.toBeNull();
    expect(screen.getAllByText(".codex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Global").length).toBeGreaterThan(0);
  });

  it("wraps gfm tables in a horizontal scroll container and preserves alignment semantics", () => {
    render(
      <Markdown
        value={[
          "| Left | Center | Right |",
          "| :--- | :----: | ----: |",
          "| alpha | beta | gamma |",
        ].join("\n")}
      />
    );

    const table = screen.getByRole("table");
    expect(table.getAttribute("data-testid")).toBe("markdown-table");
    expect(table.closest('[data-markdown-table-container="true"]')).not.toBeNull();

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0].getAttribute("style")).toBeNull();
    expect(headers[1].getAttribute("data-markdown-align")).toBe("center");
    expect(headers[2].getAttribute("data-markdown-align")).toBe("right");

    const cells = screen.getAllByRole("cell");
    expect(cells[0].getAttribute("style")).toBeNull();
    expect(cells[1].getAttribute("data-markdown-align")).toBe("center");
    expect(cells[2].getAttribute("data-markdown-align")).toBe("right");
  });

  it("owns table layout styles inside markdown styles instead of relying on page-level overrides", () => {
    const componentSource = readFileSync(resolve(import.meta.dirname, "Markdown.tsx"), "utf8");
    const stylesSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../../../../packages/design-system/src/components/RichContent.css.ts"
      ),
      "utf8"
    );

    expect(componentSource).toContain("DataTableSurface");
    expect(stylesSource).toContain("export const tableScroll = style({");
    expect(stylesSource).toContain('overflowX: "auto"');
    expect(stylesSource).toContain('scrollbarGutter: "stable both-edges"');
    expect(stylesSource).toContain('width: "max-content"');
    expect(stylesSource).toContain('minWidth: "100%"');
    expect(stylesSource).toContain('data-markdown-align="center"');
    expect(stylesSource).toContain("tbody tr:nth-child(even)");
  });

  it("owns skill reference chrome in markdown styles and keeps it flat", () => {
    const markdownSource = readFileSync(
      resolve(import.meta.dirname, "Markdown.styles.css.ts"),
      "utf8"
    );
    const skillReferenceSource = readFileSync(
      resolve(import.meta.dirname, "MarkdownSkillReference.global.css.ts"),
      "utf8"
    );
    const richContentSource = readFileSync(
      resolve(import.meta.dirname, "MessagesRichContent.global.css.ts"),
      "utf8"
    );
    const componentSource = readFileSync(resolve(import.meta.dirname, "Markdown.tsx"), "utf8");

    expect(componentSource).toContain("./MarkdownSkillReference.global.css");
    expect(markdownSource).toContain('export const skillReferenceLink = "message-skill-link";');
    expect(skillReferenceSource).toContain("feature(`.${markdownStyles.skillReferenceLink}`, {");
    expect(skillReferenceSource).toContain(
      "feature(`.${markdownStyles.skillReferenceTooltipContent}`, {"
    );
    expect(skillReferenceSource).toContain(
      'background: "color-mix(in srgb, var(--ds-surface-control) 78%, var(--ds-surface-card-base))"'
    );
    expect(skillReferenceSource).toContain('boxShadow: "none"');
    expect(skillReferenceSource).not.toContain("linear-gradient(");
    expect(skillReferenceSource).not.toContain("translateY(-1px)");
    expect(richContentSource).not.toContain("skillReferenceLink");
    expect(richContentSource).not.toContain("message-skill-link");
  });
});
