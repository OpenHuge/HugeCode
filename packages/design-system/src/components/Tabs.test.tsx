import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

describe("Tabs", () => {
  it("renders the selected panel in controlled mode", () => {
    const markup = renderToStaticMarkup(
      <Tabs value="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="files">Files panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
      </Tabs>
    );
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain("Files panel");
    expect(markup).not.toContain("History panel");
  });

  it("serializes orientation, activation mode, and selected-state markers", () => {
    const markup = renderToStaticMarkup(
      <Tabs value="history" orientation="vertical" activationMode="manual">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="files">Files panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
      </Tabs>
    );

    expect(markup).toContain('data-orientation="vertical"');
    expect(markup).toContain('data-activation-mode="manual"');
    expect(markup).toContain('data-state="inactive"');
    expect(markup).toContain('data-state="active"');
  });

  it("sources shared tabs component tokens from theme semantics", () => {
    const source = readFileSync(new URL("./Tabs.css.ts", import.meta.url), "utf8");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.tabs");
  });
});
