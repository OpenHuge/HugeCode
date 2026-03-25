import { expect, test } from "@playwright/test";
import { buildFixtureUrl } from "./fixtureHelpers";
import { stabilizeVisualSnapshot, waitForAppBootFallbackToClear } from "./helpers";

test("review-loop fixture keeps operator-loop actions aligned across continuation, Mission Control, and Review Pack", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto(buildFixtureUrl("review-loop-closure"), {
    waitUntil: "domcontentloaded",
  });
  await stabilizeVisualSnapshot(page);
  await waitForAppBootFallbackToClear(page);

  const resumeRow = page.getByTestId("operator-loop-row-resume");
  await expect(resumeRow).toContainText("Continuation facade: Resume run");
  await expect(resumeRow).toContainText(
    "Recommended step: Resume this run from the runtime takeover bundle."
  );
  await expect(resumeRow).toContainText("Target: run:run-resume");

  const takeoverRow = page.getByTestId("operator-loop-row-takeover");
  await expect(takeoverRow).toContainText("Continuation facade: Take over");
  await expect(takeoverRow).toContainText(
    "Recommended step: Use the runtime-published handoff target."
  );
  await expect(takeoverRow).toContainText("Target: thread:thread-handoff");

  const reviewRow = page.getByTestId("operator-loop-row-review");
  await expect(reviewRow).toContainText("Mission Control next step: Open Review Pack");
  await expect(reviewRow).toContainText("Review Pack next step: Open Review Pack");
  await expect(reviewRow).toContainText("Target: review:review-pack:review");

  const followUpRow = page.getByTestId("operator-loop-row-follow-up");
  await expect(followUpRow).toContainText(
    "Mission Control next step: Open the mission run and resolve the runtime-blocked follow-up."
  );
  await expect(followUpRow).toContainText(
    "Review Pack next step: Open the mission run and resolve the runtime-blocked follow-up."
  );
  await expect(followUpRow).toContainText("Target: review:review-pack:blocked");
});
