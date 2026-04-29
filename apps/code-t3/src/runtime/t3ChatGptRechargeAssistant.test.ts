import { describe, expect, it } from "vitest";
import {
  assessT3ChatGptSession,
  decryptT3ChatGptSessionVault,
  encryptT3ChatGptSessionVault,
  buildT3ChatGptRechargeActions,
} from "./t3ChatGptRechargeAssistant";

describe("t3ChatGptRechargeAssistant", () => {
  it("detects a logged-in free account without exposing sensitive fields", () => {
    const assessment = assessT3ChatGptSession(
      JSON.stringify({
        accessToken: "secret-token",
        user: {
          email: "user@example.com",
        },
        account: {
          plan: "free",
        },
      })
    );

    expect(assessment).toEqual(
      expect.objectContaining({
        accountStatus: "free",
        hasSensitivePayload: true,
        isLoggedIn: true,
      })
    );
    expect(JSON.stringify(assessment)).not.toContain("secret-token");
    expect(JSON.stringify(assessment)).not.toContain("user@example.com");
  });

  it("blocks CDK redemption guidance for subscribed accounts", () => {
    const assessment = assessT3ChatGptSession(
      JSON.stringify({
        user: {},
        account: {
          subscription: "plus",
        },
      })
    );

    expect(assessment.accountStatus).toBe("subscribed");
    expect(buildT3ChatGptRechargeActions(assessment, "CDK-1234")).toEqual([
      "Stop: this account already appears subscribed. Use a free account for this CDK.",
    ]);
  });

  it("requires login before redemption", () => {
    const assessment = assessT3ChatGptSession("{}");

    expect(assessment.accountStatus).toBe("not_logged_in");
    expect(buildT3ChatGptRechargeActions(assessment, "")).toEqual([
      "Open chatgpt.com in this browser and sign in before checking the session endpoint.",
    ]);
  });

  it("encrypts and decrypts session payloads without storing plaintext in the envelope", async () => {
    const plaintextSession = JSON.stringify({
      accessToken: "secret-token",
      user: {},
      account: {
        plan: "free",
      },
    });
    const envelope = await encryptT3ChatGptSessionVault({
      crypto,
      passphrase: "local-passphrase",
      plaintextSession,
    });

    expect(JSON.stringify(envelope)).not.toContain("secret-token");
    await expect(
      decryptT3ChatGptSessionVault({
        crypto,
        envelope,
        passphrase: "local-passphrase",
      })
    ).resolves.toBe(plaintextSession);
    await expect(
      decryptT3ChatGptSessionVault({
        crypto,
        envelope,
        passphrase: "wrong-passphrase",
      })
    ).rejects.toThrow();
  });
});
