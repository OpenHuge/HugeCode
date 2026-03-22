import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  expectCaretInsideTrigger,
  expectLabelNotClipped,
  openComposerSelectFixture,
} from "./composerSelectFixtureHelpers";

async function resolveVisibleTrigger(page: Page, name: string): Promise<Locator | null> {
  const trigger = page.getByRole("button", { name });
  if ((await trigger.count()) === 0) {
    return null;
  }
  const visible = await trigger.isVisible().catch(() => false);
  return visible ? trigger : null;
}

test("feature shared select trigger labels remain readable for reasoning and access controls", async ({
  page,
}) => {
  await openComposerSelectFixture(page, { width: 1280, height: 560 });

  const reasoningTrigger = page.getByRole("button", { name: "Thinking mode" });
  await expect(reasoningTrigger).toBeVisible();
  await reasoningTrigger.click();
  await expect(page.getByRole("listbox", { name: "Thinking mode" })).toBeVisible();
  await page.getByRole("option", { name: "medium" }).click();
  await expect(reasoningTrigger).toContainText("medium");
  await expectLabelNotClipped(reasoningTrigger);

  const accessTrigger = page.getByRole("button", { name: "Agent access" });
  await expect(accessTrigger).toBeVisible();
  await accessTrigger.click();
  await expect(page.getByRole("listbox", { name: "Agent access" })).toBeVisible();
  await page.getByRole("option", { name: "On-request" }).click();
  await expect(accessTrigger).toContainText("On-request");
  await expectLabelNotClipped(accessTrigger);
  await expectCaretInsideTrigger(accessTrigger);

  const executionTrigger = page.getByRole("button", { name: "Execution path" });
  await expect(executionTrigger).toBeVisible();
  await executionTrigger.click();
  await expect(page.getByRole("listbox", { name: "Execution path" })).toBeVisible();
  await page.getByRole("option", { name: "Runtime" }).click();
  await expect(executionTrigger).toContainText("Runtime");
  await expectLabelNotClipped(executionTrigger);
  await expectCaretInsideTrigger(executionTrigger);

  await page.setViewportSize({ width: 760, height: 560 });
  await expect(reasoningTrigger).toBeVisible();
  await reasoningTrigger.click();
  await expect(page.getByRole("listbox", { name: "Thinking mode" })).toBeVisible();
  await page.getByRole("option", { name: "medium" }).click();
  await expect(reasoningTrigger).toContainText("medium");
  await expectLabelNotClipped(reasoningTrigger);

  await expect(accessTrigger).toBeVisible();
  await accessTrigger.click();
  await expect(page.getByRole("listbox", { name: "Agent access" })).toBeVisible();
  await page.getByRole("option", { name: "On-request" }).click();
  await expect(accessTrigger).toContainText("On-request");
  await expectLabelNotClipped(accessTrigger);
  await expectCaretInsideTrigger(accessTrigger);

  await expect(executionTrigger).toBeVisible();
  await executionTrigger.click();
  await expect(page.getByRole("listbox", { name: "Execution path" })).toBeVisible();
  await page.getByRole("option", { name: "Runtime" }).click();
  await expect(executionTrigger).toContainText("Runtime");
  await expectLabelNotClipped(executionTrigger);
  await expectCaretInsideTrigger(executionTrigger);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileReasoningTrigger = await resolveVisibleTrigger(page, "Thinking mode");
  if (mobileReasoningTrigger) {
    await mobileReasoningTrigger.scrollIntoViewIfNeeded();
    await mobileReasoningTrigger.click({ timeout: 10_000 });
    await expect(page.getByRole("listbox", { name: "Thinking mode" })).toBeVisible();
    await page.getByRole("option", { name: "medium" }).click();
    await expect(mobileReasoningTrigger).toContainText("medium");
    await expectLabelNotClipped(mobileReasoningTrigger);
    await expectCaretInsideTrigger(mobileReasoningTrigger);
  }

  const mobileAccessTrigger = await resolveVisibleTrigger(page, "Agent access");
  if (mobileAccessTrigger) {
    await mobileAccessTrigger.scrollIntoViewIfNeeded();
    await mobileAccessTrigger.click({ timeout: 10_000 });
    await expect(page.getByRole("listbox", { name: "Agent access" })).toBeVisible();
    await page.getByRole("option", { name: "On-request" }).click();
    await expect(mobileAccessTrigger).toContainText("On-request");
    await expectLabelNotClipped(mobileAccessTrigger);
    await expectCaretInsideTrigger(mobileAccessTrigger);
  }

  const mobileExecutionTrigger = await resolveVisibleTrigger(page, "Execution path");
  if (mobileExecutionTrigger) {
    await mobileExecutionTrigger.scrollIntoViewIfNeeded();
    await mobileExecutionTrigger.click({ timeout: 10_000 });
    await expect(page.getByRole("listbox", { name: "Execution path" })).toBeVisible();
    await page.getByRole("option", { name: "Runtime" }).click();
    await expect(mobileExecutionTrigger).toContainText("Runtime");
    await expectLabelNotClipped(mobileExecutionTrigger);
    await expectCaretInsideTrigger(mobileExecutionTrigger);
  }
});
