import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineActionRow, MetadataList, MetadataRow } from "./Rows";

describe("Rows", () => {
  it("renders metadata rows inside a list", () => {
    const markup = renderToStaticMarkup(
      <MetadataList>
        <MetadataRow label="Status" value="Ready" />
      </MetadataList>
    );

    expect(markup).toContain("Status");
    expect(markup).toContain("Ready");
    expect(markup).toContain('data-family="text"');
    expect(markup).toContain('data-size="fine"');
    expect(markup).toContain('data-size="meta"');
    expect(markup).toContain('data-tone="muted"');
    expect(markup).toContain('data-tone="strong"');
  });

  it("renders inline actions with supporting copy", () => {
    const markup = renderToStaticMarkup(
      <InlineActionRow
        label="Open workspace"
        description="Use the current connected repo"
        action={<button type="button">Open</button>}
      />
    );

    expect(markup).toContain("Open workspace");
    expect(markup).toContain("Use the current connected repo");
    expect(markup).toContain("Open");
    expect(markup).toContain('data-family="text"');
    expect(markup).toContain('data-size="meta"');
    expect(markup).toContain('data-size="fine"');
    expect(markup).toContain('data-tone="strong"');
    expect(markup).toContain('data-tone="muted"');
  });
});
