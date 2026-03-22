import { describe, expect, it } from "vitest";
import { normalizeResolvedTheme, normalizeTheme, ThemeProvider } from "./ThemeProvider";

describe("@ku0/ui ThemeProvider", () => {
  it("normalizes dim as a first-class theme option", () => {
    expect(normalizeTheme("dim")).toBe("dim");
    expect(normalizeTheme("system")).toBe("system");
    expect(normalizeTheme("unexpected")).toBe("system");
  });

  it("maps dim into the dark resolved-theme bucket", () => {
    expect(normalizeResolvedTheme("dim")).toBe("dark");
    expect(normalizeResolvedTheme("dark")).toBe("dark");
    expect(normalizeResolvedTheme("light")).toBe("light");
  });

  it("configures next-themes to use the shared data-theme contract", () => {
    const rendered = ThemeProvider({ children: "ready" });
    expect(rendered.props.attribute).toBe("data-theme");
    expect(rendered.props.defaultTheme).toBe("system");
    expect(rendered.props.enableSystem).toBe(true);
    expect(rendered.props.disableTransitionOnChange).toBe(true);
    expect(rendered.props.themes).toEqual(["dark", "dim", "light"]);
  });
});
