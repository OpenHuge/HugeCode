import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, CardDescription, CardTitle } from "./Card";

describe("Card", () => {
  it("renders header and footer slots", () => {
    const markup = renderToStaticMarkup(
      <Card
        header={
          <>
            <CardTitle>Agent status</CardTitle>
            <CardDescription>Streaming</CardDescription>
          </>
        }
        footer={<span>Updated just now</span>}
      >
        Body
      </Card>
    );
    expect(markup).toContain("Agent status");
    expect(markup).toContain("Updated just now");
  });

  it("accepts variant as a compatibility alias for tone", () => {
    const markup = renderToStaticMarkup(<Card variant="translucent">Body</Card>);

    expect(markup).toContain('data-tone="translucent"');
  });
});
