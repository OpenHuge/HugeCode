import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { T3DeliveryArtifactUpload, T3DeliveryService } from "../runtime/t3DeliveryService";
import { T3OperatorWorkspacePanel } from "./T3OperatorWorkspacePanel";

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
});

function renderPanel(
  options: {
    accountImportCode?: string;
    deliveryService?: T3DeliveryService;
    loginStateStatus?: "loggedIn" | "notLoggedIn" | "unknown";
    onExportAccountFile?: () => Promise<T3DeliveryArtifactUpload | null>;
  } = {}
) {
  const container = document.createElement("div");
  const onNotice = vi.fn();
  const onAccountImportCodeChange = vi.fn();
  const deliveryService =
    options.deliveryService ??
    ({
      prepare: vi.fn(async () => ({
        activationCode: "customer-redemption-code",
        browserFileUnlockCode: "server-file-code",
        deliveryId: "delivery-1",
        entitlementSummary: null,
        fileHash: null,
        status: "prepared" as const,
        summary: "Prepared by adapter.",
        updatedAt: null,
      })),
      readStatus: vi.fn(),
      redeem: vi.fn(),
      submitExportWitness: vi.fn(async () => ({
        activationCode: null,
        browserFileUnlockCode: "server-file-code",
        deliveryId: "delivery-1",
        entitlementSummary: null,
        fileHash: "a".repeat(64),
        status: "exported" as const,
        summary: "Exported by adapter.",
        updatedAt: null,
      })),
      uploadArtifact: vi.fn(async () => ({
        activationCode: "remote-code-1",
        browserFileUnlockCode: "server-file-code",
        deliveryId: "delivery-1",
        entitlementSummary: "Valid until backend-provided date.",
        fileHash: "a".repeat(64),
        status: "exported" as const,
        summary: "Exported by adapter.",
        updatedAt: null,
      })),
    } satisfies T3DeliveryService);
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <T3OperatorWorkspacePanel
        accountImportCode={options.accountImportCode ?? "delivery-code"}
        busy={false}
        deliveryService={deliveryService}
        loginStateStatus={options.loginStateStatus ?? "loggedIn"}
        notice={null}
        onAccountImportCodeChange={onAccountImportCodeChange}
        onCheckLoginState={async () => ({
          allowedOrigins: ["https://chatgpt.com"],
          cookieCount: 2,
          originCount: 1,
          provider: "chatgpt",
          status: options.loginStateStatus ?? "loggedIn",
          storageFileCount: 1,
          summary: "Login ready.",
        })}
        onExportAccountFile={options.onExportAccountFile ?? vi.fn(async () => null)}
        onNotice={onNotice}
        onOpenChatGptCapture={vi.fn()}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container, deliveryService, onAccountImportCodeChange, onNotice };
}

function buttons(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button"));
}

describe("T3OperatorWorkspacePanel", () => {
  it("does not enable export before backend prepared", () => {
    const { container } = renderPanel();

    expect(container.textContent).toContain("已登录");
    expect(container.textContent).toContain("已准备");
    expect(container.textContent).toContain("可导出");
    expect(container.textContent).toContain("已导出");
    expect(container.querySelector("input[aria-label='交付解锁码']")).not.toBeNull();
    expect(container.textContent).toContain("客户只需一个兑换码恢复");
    expect(buttons(container)[2]?.getAttribute("aria-disabled")).toBe("true");
  });

  it("prepares delivery through adapter projection before enabling export", async () => {
    const { container, deliveryService, onAccountImportCodeChange, onNotice } = renderPanel();

    await act(async () => {
      buttons(container)[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deliveryService.prepare).toHaveBeenCalledWith({ provider: "chatgpt" });
    expect(container.textContent).toContain("delivery-1");
    expect(container.textContent).toContain("交付解锁码已就绪，可以上传");
    expect(buttons(container)[2]?.getAttribute("aria-disabled")).toBe("false");
    expect(onAccountImportCodeChange).toHaveBeenCalledWith("customer-redemption-code");
    expect(onNotice).toHaveBeenCalledWith("Prepared by adapter.");
  });

  it("shows exported completion after local export witness is accepted", async () => {
    const { container, deliveryService } = renderPanel({
      onExportAccountFile: vi.fn(async () => ({
        serialized: "encrypted payload",
        witness: {
          byteLength: 128,
          exportedAt: "2026-05-05T14:00:00.000Z",
          fileHash: "b".repeat(64),
          fileName: "hugecode-browser-data-2026-05-05.hcbrowser",
        },
      })),
    });

    await act(async () => {
      buttons(container)[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttons(container)[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deliveryService.uploadArtifact).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("已导出");
    expect(container.textContent).toContain("后端投影已接受上传与 witness");
    expect(container.textContent).toContain(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(container.textContent).toContain("remote-code-1");
    expect(container.textContent).toContain("使用客户兑换码");
    expect(container.textContent).toContain("Valid until backend-provided date.");
  });

  it("keeps the prepare redemption code visible when upload status omits one-time codes", async () => {
    const deliveryService: T3DeliveryService = {
      prepare: vi.fn(async () => ({
        activationCode: "ku0-red-v1-260506-customer-code",
        browserFileUnlockCode: "ku0-brw-v1-260506-file-unlock",
        deliveryId: "delivery-1",
        entitlementSummary: "Prepared entitlement.",
        fileHash: null,
        status: "prepared" as const,
        summary: "Prepared by adapter.",
        updatedAt: null,
      })),
      readStatus: vi.fn(),
      redeem: vi.fn(),
      submitExportWitness: vi.fn(),
      uploadArtifact: vi.fn(async () => ({
        activationCode: null,
        browserFileUnlockCode: null,
        deliveryId: "delivery-1",
        entitlementSummary: null,
        fileHash: "c".repeat(64),
        status: "exported" as const,
        summary: "Exported by adapter.",
        updatedAt: null,
      })),
    };
    const { container } = renderPanel({
      deliveryService,
      onExportAccountFile: vi.fn(async () => ({
        serialized: "encrypted payload",
        witness: {
          byteLength: 128,
          exportedAt: "2026-05-05T14:00:00.000Z",
          fileHash: "c".repeat(64),
          fileName: "hugecode-browser-data-2026-05-05.hcbrowser",
        },
      })),
    });

    await act(async () => {
      buttons(container)[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttons(container)[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("ku0-red-v1-260506-customer-code");
    expect(container.textContent).toContain("使用客户兑换码");
    expect(container.textContent).toContain(
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    );
  });

  it("keeps export blocked when the local file unlock code is missing", async () => {
    const { container } = renderPanel({ accountImportCode: "" });

    await act(async () => {
      buttons(container)[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(buttons(container)[2]?.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps export blocked when backend does not return prepared", async () => {
    const { container, onNotice } = renderPanel({
      deliveryService: {
        prepare: vi.fn(async () => ({
          activationCode: null,
          browserFileUnlockCode: null,
          deliveryId: "delivery-1",
          entitlementSummary: null,
          fileHash: null,
          status: "failed" as const,
          summary: "Adapter rejected delivery.",
          updatedAt: null,
        })),
        readStatus: vi.fn(),
        redeem: vi.fn(),
        submitExportWitness: vi.fn(),
        uploadArtifact: vi.fn(),
      },
    });

    await act(async () => {
      buttons(container)[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(buttons(container)[2]?.getAttribute("aria-disabled")).toBe("true");
    expect(onNotice).toHaveBeenCalledWith("Adapter rejected delivery.");
    expect(container.textContent).toContain("failed");
  });

  it("shows unavailable without enabling export when the default adapter is not connected", async () => {
    const { container, onNotice } = renderPanel({
      deliveryService: {
        prepare: vi.fn(async () => ({
          activationCode: null,
          browserFileUnlockCode: null,
          deliveryId: null,
          entitlementSummary: null,
          fileHash: null,
          status: "unavailable" as const,
          summary: "Delivery backend adapter is not connected.",
          updatedAt: null,
        })),
        readStatus: vi.fn(),
        redeem: vi.fn(),
        submitExportWitness: vi.fn(),
        uploadArtifact: vi.fn(),
      },
    });

    await act(async () => {
      buttons(container)[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(buttons(container)[2]?.getAttribute("aria-disabled")).toBe("true");
    expect(onNotice).toHaveBeenCalledWith("Delivery backend adapter is not connected.");
    expect(container.textContent).toContain("unavailable");
    expect(container.textContent).toContain("后端未接入");
  });
});
