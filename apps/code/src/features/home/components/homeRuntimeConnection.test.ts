import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_RUNTIME_PORT,
  parseRemoteRuntimeAddress,
  parseRuntimeConnectionDraft,
  parseRuntimePortDraft,
} from "./homeRuntimeConnection";

describe("homeRuntimeConnection", () => {
  it("uses the default local runtime port when no local draft is provided", () => {
    expect(parseRuntimePortDraft("")).toEqual({
      host: null,
      port: DEFAULT_LOCAL_RUNTIME_PORT,
      preview: `http://localhost / 127.0.0.1:${DEFAULT_LOCAL_RUNTIME_PORT}/rpc`,
    });
  });

  it("rejects invalid local runtime ports", () => {
    expect(parseRuntimePortDraft("70000")).toEqual({
      error: "Enter a valid runtime port between 1 and 65535.",
    });
  });

  it("parses a remote host and port without an explicit protocol", () => {
    expect(parseRemoteRuntimeAddress("runtime.example.com:8899")).toEqual({
      host: "runtime.example.com",
      port: 8899,
      preview: "http://runtime.example.com:8899/rpc",
    });
  });

  it("parses a full remote runtime URL and preserves its scheme", () => {
    expect(parseRemoteRuntimeAddress("https://runtime.example.com:9443/rpc")).toEqual({
      host: "runtime.example.com",
      port: 9443,
      preview: "https://runtime.example.com:9443/rpc",
    });
  });

  it("falls back to the default port when a remote address omits one", () => {
    expect(parseRemoteRuntimeAddress("https://runtime.example.com")).toEqual({
      host: "runtime.example.com",
      port: DEFAULT_LOCAL_RUNTIME_PORT,
      preview: `https://runtime.example.com:${DEFAULT_LOCAL_RUNTIME_PORT}/rpc`,
    });
  });

  it("rejects unsupported remote protocols", () => {
    expect(parseRemoteRuntimeAddress("ftp://runtime.example.com:2121")).toEqual({
      error: "Use an http, https, ws, or wss runtime address.",
    });
  });

  it("treats an empty unified runtime target as the default local port", () => {
    expect(parseRuntimeConnectionDraft("")).toEqual({
      host: null,
      port: DEFAULT_LOCAL_RUNTIME_PORT,
      preview: `http://localhost / 127.0.0.1:${DEFAULT_LOCAL_RUNTIME_PORT}/rpc`,
    });
  });

  it("treats a numeric unified runtime target as a local port", () => {
    expect(parseRuntimeConnectionDraft("8899")).toEqual({
      host: null,
      port: 8899,
      preview: "http://localhost / 127.0.0.1:8899/rpc",
    });
  });

  it("treats a hostname unified runtime target as a remote address", () => {
    expect(parseRuntimeConnectionDraft("runtime.example.com:8899")).toEqual({
      host: "runtime.example.com",
      port: 8899,
      preview: "http://runtime.example.com:8899/rpc",
    });
  });

  it("rejects unsupported protocols in the unified runtime target", () => {
    expect(parseRuntimeConnectionDraft("ftp://runtime.example.com:2121")).toEqual({
      error: "Use an http, https, ws, or wss runtime address.",
    });
  });
});
