import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("maps semantic status tones onto shared chip badge markers", () => {
    const defaultMarkup = renderToStaticMarkup(<StatusBadge>Idle</StatusBadge>);
    expect(defaultMarkup).toContain("Idle");
    expect(defaultMarkup).toContain('data-status-tone="default"');
    expect(defaultMarkup).toContain('data-tone="neutral"');
    expect(defaultMarkup).toContain('data-shape="chip"');
    expect(defaultMarkup).toContain('data-size="md"');

    const errorMarkup = renderToStaticMarkup(<StatusBadge tone="error">Disabled</StatusBadge>);
    expect(errorMarkup).toContain('data-status-tone="error"');
    expect(errorMarkup).toContain('data-tone="danger"');
  });
});
