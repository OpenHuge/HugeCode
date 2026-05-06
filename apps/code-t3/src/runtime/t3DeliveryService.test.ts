import { describe, expect, it, vi } from "vitest";
import {
  createOpenHugeDeliveryTransport,
  createT3DeliveryExportWitness,
  createT3DeliveryService,
  normalizeOpenHugeDeliveryProjection,
  normalizeT3DeliveryProjection,
  normalizeT3DeliveryRedeemResult,
  readOpenHugeDeliveryConfig,
  type T3OpenHugeDeliveryConfig,
} from "./t3DeliveryService";

const openHugeConfig: T3OpenHugeDeliveryConfig = {
  authToken: null,
  baseUrl: "https://openhuge.example",
  projectId: "proj_core",
  provider: "chatgpt",
  serviceDays: 30,
  serviceKind: "manual_browser_account",
  tenantId: "tenant_acme",
};

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json",
      ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : {}),
    },
    status: init.status ?? 200,
  });
}

describe("t3DeliveryService", () => {
  it("normalizes injected delivery projections through the adapter", async () => {
    const transport = vi.fn(async () => ({
      browserFileUnlockCode: "server-file-code",
      deliveryId: "delivery-1",
      status: "prepared",
      summary: "Prepared by adapter.",
    }));
    const service = createT3DeliveryService(transport);

    await expect(service.prepare({ provider: "chatgpt" })).resolves.toEqual(
      expect.objectContaining({
        browserFileUnlockCode: "server-file-code",
        deliveryId: "delivery-1",
        entitlementSummary: null,
        status: "prepared",
      })
    );
    expect(transport).toHaveBeenCalledWith({
      body: { provider: "chatgpt" },
      operation: "prepare",
    });
  });

  it("keeps the default transport unavailable instead of calling a backend", async () => {
    const service = createT3DeliveryService();

    await expect(service.prepare({ provider: "chatgpt" })).resolves.toEqual(
      expect.objectContaining({
        deliveryId: null,
        status: "unavailable",
      })
    );
  });

  it("rejects projections without backend delivery id", () => {
    expect(() => normalizeT3DeliveryProjection({ status: "prepared" })).toThrow(
      "Delivery service did not return a delivery id."
    );
  });

  it("allows an unavailable projection without a delivery id", () => {
    expect(normalizeT3DeliveryProjection({ status: "unavailable" })).toEqual(
      expect.objectContaining({
        deliveryId: null,
        status: "unavailable",
      })
    );
  });

  it("uploads encrypted browser account artifacts through the adapter", async () => {
    const transport = vi.fn(async () => ({
      activationCode: "remote-code-1",
      deliveryId: "delivery-1",
      fileHash: "a".repeat(64),
      status: "exported",
      summary: "Uploaded by adapter.",
    }));
    const service = createT3DeliveryService(transport);

    await expect(
      service.uploadArtifact({
        deliveryId: "delivery-1",
        artifact: {
          serialized: "encrypted payload",
          witness: {
            byteLength: 17,
            exportedAt: "2026-05-06T00:00:00.000Z",
            fileHash: "a".repeat(64),
            fileName: "hugecode-browser-data.hcbrowser",
          },
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        activationCode: "remote-code-1",
        fileHash: "a".repeat(64),
        status: "exported",
      })
    );
    expect(transport).toHaveBeenCalledWith({
      body: {
        artifact: {
          fileName: "hugecode-browser-data.hcbrowser",
          serialized: "encrypted payload",
        },
        deliveryId: "delivery-1",
        witness: {
          byteLength: 17,
          exportedAt: "2026-05-06T00:00:00.000Z",
          fileHash: "a".repeat(64),
          fileName: "hugecode-browser-data.hcbrowser",
        },
      },
      operation: "uploadArtifact",
    });
  });

  it("normalizes redemption downloads without requiring backend file unlock projection", async () => {
    const transport = vi.fn(async () => ({
      artifact: {
        byteLength: 17,
        fileHash: "b".repeat(64),
        fileName: "hugecode-browser-data.hcbrowser",
        serialized: "encrypted payload",
      },
      projection: {
        activationCode: "remote-code-1",
        deliveryId: "delivery-1",
        status: "redeemed",
        summary: "Redeemed by adapter.",
      },
    }));
    const service = createT3DeliveryService(transport);

    await expect(service.redeem({ activationCode: "remote-code-1" })).resolves.toEqual({
      artifact: expect.objectContaining({
        fileHash: "b".repeat(64),
        fileName: "hugecode-browser-data.hcbrowser",
      }),
      projection: expect.objectContaining({
        browserFileUnlockCode: null,
        status: "redeemed",
      }),
    });
    expect(transport).toHaveBeenCalledWith({
      body: { activationCode: "remote-code-1" },
      operation: "redeem",
    });
  });

  it("allows unavailable, expired, revoked, and file unavailable redemption without artifacts", () => {
    for (const status of ["expired", "fileUnavailable", "revoked", "unavailable"] as const) {
      expect(normalizeT3DeliveryRedeemResult({ status })).toEqual({
        artifact: null,
        projection: expect.objectContaining({ status }),
      });
    }
  });

  it("keeps network failures fail-closed without returning an artifact", async () => {
    const service = createT3DeliveryService(
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(service.redeem({ activationCode: "remote-code-1" })).resolves.toEqual({
      artifact: null,
      projection: expect.objectContaining({
        status: "failed",
      }),
    });
  });

  it("reads entitlement and artifact status through the adapter", async () => {
    const transport = vi.fn(async () => ({
      deliveryId: "delivery-1",
      entitlementSummary: "Valid until backend-provided date.",
      status: "prepared",
      summary: "Status projected by adapter.",
    }));
    const service = createT3DeliveryService(transport);

    await expect(service.readStatus({ deliveryId: "delivery-1" })).resolves.toEqual(
      expect.objectContaining({
        entitlementSummary: "Valid until backend-provided date.",
        status: "prepared",
      })
    );
    expect(transport).toHaveBeenCalledWith({
      body: { deliveryId: "delivery-1" },
      operation: "readStatus",
    });
  });

  it("rejects sensitive export witness payload", async () => {
    const service = createT3DeliveryService(vi.fn());

    await expect(
      service.submitExportWitness({
        deliveryId: "delivery-1",
        witness: {
          byteLength: 10,
          exportedAt: "2026-05-05T00:00:00.000Z",
          fileHash: "cookie".padEnd(64, "a"),
          fileName: "hugecode-browser-data.hcbrowser",
        },
      })
    ).rejects.toThrow("Export witness must not contain sensitive browser or credential data.");
  });

  it("creates a non-sensitive file witness from serialized account data", async () => {
    const witness = await createT3DeliveryExportWitness({
      fileName: "hugecode-browser-data.hcbrowser",
      serialized: "encrypted payload",
    });

    expect(witness.fileHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(witness.byteLength).toBeGreaterThan(0);
    expect(witness).not.toEqual(expect.objectContaining({ serialized: "encrypted payload" }));
  });

  it("reads OpenHuge delivery config only when required projection settings exist", () => {
    expect(
      readOpenHugeDeliveryConfig({
        VITE_OPENHUGE_CONTROL_PLANE_BASE_URL: "https://openhuge.example",
        VITE_OPENHUGE_PROJECT_ID: "proj_core",
        VITE_OPENHUGE_TENANT_ID: "tenant_acme",
      })
    ).toEqual(
      expect.objectContaining({
        baseUrl: "https://openhuge.example",
        projectId: "proj_core",
        serviceDays: 30,
        serviceKind: "manual_browser_account",
        tenantId: "tenant_acme",
      })
    );
    expect(
      readOpenHugeDeliveryConfig({
        VITE_OPENHUGE_CONTROL_PLANE_BASE_URL: "https://openhuge.example",
      })
    ).toBeNull();
  });

  it("maps OpenHuge prepare responses into the frontend projection", () => {
    expect(
      normalizeOpenHugeDeliveryProjection(
        {
          data: {
            delivery: {
              delivery_id: "delivery_10001",
              status: "prepared",
              updated_at: "2026-05-05T10:00:00Z",
            },
            entitlement: {
              service_days: 30,
              service_ends_at: "2026-06-04T10:00:00Z",
              status: "active",
            },
          },
          one_time_codes: {
            browser_file_unlock_code: "ku0-brw-v1-260505-j9k0-l1m2n3p4q5r6-76",
            redemption_code: "ku0-red-v1-260505-a1b2-c3d4e5f6g7h8-7b",
          },
        },
        { status: "prepared" }
      )
    ).toEqual(
      expect.objectContaining({
        activationCode: "ku0-red-v1-260505-a1b2-c3d4e5f6g7h8-7b",
        browserFileUnlockCode: "ku0-brw-v1-260505-j9k0-l1m2n3p4q5r6-76",
        deliveryId: "delivery_10001",
        entitlementSummary: "status=active, service_days=30, ends_at=2026-06-04T10:00:00Z",
        status: "prepared",
      })
    );
  });

  it("calls OpenHuge prepare through the real transport", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        data: {
          delivery: {
            delivery_id: "delivery_10001",
            status: "prepared",
          },
        },
        one_time_codes: {
          browser_file_unlock_code: "ku0-brw-v1-260505-j9k0-l1m2n3p4q5r6-76",
          redemption_code: "ku0-red-v1-260505-a1b2-c3d4e5f6g7h8-7b",
        },
      })
    );
    const service = createT3DeliveryService(
      createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
    );

    await expect(service.prepare({ provider: "chatgpt" })).resolves.toEqual(
      expect.objectContaining({
        activationCode: "ku0-red-v1-260505-a1b2-c3d4e5f6g7h8-7b",
        browserFileUnlockCode: "ku0-brw-v1-260505-j9k0-l1m2n3p4q5r6-76",
        deliveryId: "delivery_10001",
      })
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://openhuge.example/v1/deliveries/prepare",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        project_id: "proj_core",
        provider: "chatgpt",
        service_kind: "manual_browser_account",
        tenant_id: "tenant_acme",
      })
    );
  });

  it("normalizes OpenHuge prepare responses returned through the desktop bridge", async () => {
    const desktopInvoke = vi.fn(async () => ({
      data: {
        delivery: {
          delivery_id: "delivery_desktop_10001",
          status: "prepared",
        },
        entitlement: {
          service_days: 30,
          service_ends_at: "2026-06-04T10:00:00Z",
          status: "active",
        },
      },
      one_time_codes: {
        browser_file_unlock_code: "ku0-brw-v1-260505-desktop-unlock-76",
        redemption_code: "ku0-red-v1-260505-desktop-redeem-7b",
      },
    }));
    const desktopWindow = window as Window & {
      hugeCodeDesktopHost?: {
        openHugeDelivery?: {
          invoke: typeof desktopInvoke;
        };
      };
    };
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    desktopWindow.hugeCodeDesktopHost = {
      openHugeDelivery: {
        invoke: desktopInvoke,
      },
    };
    try {
      const service = createT3DeliveryService(
        createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
      );

      await expect(service.prepare({ provider: "chatgpt" })).resolves.toEqual(
        expect.objectContaining({
          activationCode: "ku0-red-v1-260505-desktop-redeem-7b",
          browserFileUnlockCode: "ku0-brw-v1-260505-desktop-unlock-76",
          deliveryId: "delivery_desktop_10001",
          status: "prepared",
        })
      );
      expect(desktopInvoke).toHaveBeenCalledWith("prepare", { provider: "chatgpt" });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      delete desktopWindow.hugeCodeDesktopHost;
    }
  });

  it("uses the desktop bridge for customer readStatus refreshes", async () => {
    const desktopInvoke = vi.fn(async () => ({
      data: {
        artifact: {
          sha256: `sha256:${"d".repeat(64)}`,
          status: "active",
        },
        delivery: {
          delivery_id: "delivery_desktop_10002",
          status: "active",
          updated_at: "2026-05-06T04:40:00Z",
        },
      },
    }));
    const desktopWindow = window as Window & {
      hugeCodeDesktopHost?: {
        openHugeDelivery?: {
          invoke: typeof desktopInvoke;
        };
      };
    };
    desktopWindow.hugeCodeDesktopHost = {
      openHugeDelivery: {
        invoke: desktopInvoke,
      },
    };
    try {
      const service = createT3DeliveryService(createOpenHugeDeliveryTransport(openHugeConfig));

      await expect(service.readStatus({ deliveryId: "delivery_desktop_10002" })).resolves.toEqual(
        expect.objectContaining({
          deliveryId: "delivery_desktop_10002",
          fileHash: "d".repeat(64),
          status: "exported",
        })
      );
      expect(desktopInvoke).toHaveBeenCalledWith("readStatus", {
        deliveryId: "delivery_desktop_10002",
      });
    } finally {
      delete desktopWindow.hugeCodeDesktopHost;
    }
  });

  it("surfaces desktop bridge readStatus failures instead of generic fail-closed text", async () => {
    const desktopInvoke = vi.fn(async () => {
      throw new Error("OpenHuge delivery operation readStatus is not available from desktop.");
    });
    const desktopWindow = window as Window & {
      hugeCodeDesktopHost?: {
        openHugeDelivery?: {
          invoke: typeof desktopInvoke;
        };
      };
    };
    desktopWindow.hugeCodeDesktopHost = {
      openHugeDelivery: {
        invoke: desktopInvoke,
      },
    };
    try {
      const service = createT3DeliveryService(createOpenHugeDeliveryTransport(openHugeConfig));

      await expect(service.readStatus({ deliveryId: "delivery_desktop_10002" })).resolves.toEqual(
        expect.objectContaining({
          status: "failed",
          summary: "OpenHuge delivery operation readStatus is not available from desktop.",
        })
      );
    } finally {
      delete desktopWindow.hugeCodeDesktopHost;
    }
  });

  it("binds the browser global fetch when constructing the real transport", async () => {
    const originalFetch = globalThis.fetch;
    const strictFetch = vi.fn(function (this: unknown, _url: string, _init?: RequestInit) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(
        jsonResponse({
          data: {
            delivery: {
              delivery_id: "delivery_10001",
              status: "prepared",
            },
          },
          one_time_codes: {
            browser_file_unlock_code: "ku0-brw-v1-260505-j9k0-l1m2n3p4q5r6-76",
            redemption_code: "ku0-red-v1-260505-a1b2-c3d4e5f6g7h8-7b",
          },
        })
      );
    });
    vi.stubGlobal("fetch", strictFetch);
    try {
      const service = createT3DeliveryService(
        createOpenHugeDeliveryTransport(openHugeConfig, globalThis.fetch)
      );

      await expect(service.prepare({ provider: "chatgpt" })).resolves.toEqual(
        expect.objectContaining({
          activationCode: "ku0-red-v1-260505-a1b2-c3d4e5f6g7h8-7b",
          browserFileUnlockCode: "ku0-brw-v1-260505-j9k0-l1m2n3p4q5r6-76",
          deliveryId: "delivery_10001",
        })
      );
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("does not mark queued OpenHuge uploads as exported", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              batch_id: "dlvup_10004",
              status: "queued",
            },
          },
          { status: 202 }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              delivery_id: "delivery_10001",
              payload_sha256: `sha256:${"c".repeat(64)}`,
              status: "processing",
            },
          ],
        })
      );
    const service = createT3DeliveryService(
      createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
    );

    await expect(
      service.uploadArtifact({
        deliveryId: "delivery_10001",
        artifact: {
          serialized: "encrypted payload",
          witness: {
            byteLength: 17,
            exportedAt: "2026-05-06T00:00:00.000Z",
            fileHash: "c".repeat(64),
            fileName: "hugecode-browser-data.hcbrowser",
          },
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        deliveryId: "delivery_10001",
        fileHash: "c".repeat(64),
        status: "prepared",
      })
    );
  });

  it("maps accepted OpenHuge upload items to exported with pure sha256 hex", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T00:00:00.000Z"));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              batch_id: "dlvup_10004",
              status: "queued",
            },
          },
          { status: 202 }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              delivery_id: "delivery_10001",
              payload_sha256: `sha256:${"d".repeat(64)}`,
              status: "accepted",
              updated_at: "2026-05-05T10:05:00Z",
            },
          ],
        })
      );
    const service = createT3DeliveryService(
      createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
    );

    try {
      await expect(
        service.uploadArtifact({
          deliveryId: "delivery_10001",
          artifact: {
            serialized: "encrypted payload",
            witness: {
              byteLength: 17,
              exportedAt: "2026-05-06T00:00:00.000Z",
              fileHash: "c".repeat(64),
              fileName: "hugecode-browser-data.hcbrowser",
            },
          },
        })
      ).resolves.toEqual(
        expect.objectContaining({
          fileHash: "d".repeat(64),
          status: "exported",
        })
      );
      const uploadBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
      expect(uploadBody.items[0].carrier_valid_until).toBe("2026-06-05T00:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("redeems through OpenHuge activation, grant, and artifact download without unlock code echo", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            activation_id: "activation_10002",
            artifact_id: "artifact_10002",
            artifact: {
              artifact_id: "artifact_10002",
              carrier_valid_until: "2026-05-20T10:00:00Z",
              file_name: "acme-may.hcbrowser",
              sha256: `sha256:${"e".repeat(64)}`,
              status: "active",
            },
            delivery_id: "delivery_10001",
            entitlement_ends_at: "2026-06-04T10:00:00Z",
            entitlement_id: "dlvent_delivery_10001",
            status: "activated",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            artifact_id: "artifact_10002",
            artifact: {
              artifact_id: "artifact_10002",
              carrier_valid_until: "2026-05-20T10:00:00Z",
              file_name: "acme-may.hcbrowser",
              sha256: `sha256:${"e".repeat(64)}`,
              status: "active",
            },
            entitlement_id: "dlvent_delivery_10001",
            grant_id: "dlgrant_10003",
            status: "active",
          },
          download_token: "dlt_once_returned_plaintext_token_20260506",
        })
      )
      .mockResolvedValueOnce(
        new Response("encrypted hcbrowser payload", {
          headers: {
            "content-disposition": 'attachment; filename="acme-may.hcbrowser"',
            "content-length": "26",
            "x-openhuge-artifact-sha256": `sha256:${"e".repeat(64)}`,
          },
          status: 200,
        })
      );
    const service = createT3DeliveryService(
      createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
    );

    await expect(service.redeem({ activationCode: "ku0-red-v1-valid-code" })).resolves.toEqual({
      artifact: expect.objectContaining({
        fileHash: "e".repeat(64),
        fileName: "acme-may.hcbrowser",
        serialized: "encrypted hcbrowser payload",
      }),
      projection: expect.objectContaining({
        activationId: "activation_10002",
        artifactId: "artifact_10002",
        browserFileUnlockCode: null,
        deliveryId: "delivery_10001",
        effectiveUntil: "2026-05-20T10:00:00Z",
        entitlementEndsAt: "2026-06-04T10:00:00Z",
        entitlementId: "dlvent_delivery_10001",
        fileHash: "e".repeat(64),
        status: "redeemed",
      }),
    });
    expect(fetcher.mock.calls[2]?.[1]?.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer dlt_once_returned_plaintext_token_20260506",
      })
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      activation_id: "activation_10002",
      redemption_code: "ku0-red-v1-valid-code",
    });
  });

  it("maps OpenHuge expired redemption errors fail-closed without artifact", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          code: "redemption_code_expired",
          message: "redemption_code is expired",
        },
        { status: 400 }
      )
    );
    const service = createT3DeliveryService(
      createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
    );

    await expect(service.redeem({ activationCode: "ku0-red-v1-expired-code" })).resolves.toEqual({
      artifact: null,
      projection: expect.objectContaining({
        status: "expired",
        summary: "redemption_code is expired",
      }),
    });
  });

  it("maps inactive entitlement lifecycle errors into blocking statuses", async () => {
    for (const [message, status] of [
      ["delivery entitlement status `expired` cannot issue a download grant", "expired"],
      ["delivery entitlement status `revoked` cannot issue a download grant", "revoked"],
      ["delivery entitlement status `paused` cannot issue a download grant", "fileUnavailable"],
    ] as const) {
      const fetcher = vi.fn(async () =>
        jsonResponse(
          {
            code: "delivery_entitlement_not_active",
            message,
          },
          { status: 409 }
        )
      );
      const service = createT3DeliveryService(
        createOpenHugeDeliveryTransport(openHugeConfig, fetcher)
      );

      await expect(
        service.redeem({ activationCode: "ku0-red-v1-lifecycle-code" })
      ).resolves.toEqual({
        artifact: null,
        projection: expect.objectContaining({
          status,
          summary: message,
        }),
      });
    }
  });
});
