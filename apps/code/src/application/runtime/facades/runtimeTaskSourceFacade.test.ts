import { describe, expect, it } from "vitest";
import { resolveRepoContext } from "./runtimeTaskSourceFacade";

describe("runtimeTaskSourceFacade", () => {
  it("normalizes GitHub issue URLs to canonical repository URLs when no git remote is loaded", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/issues/42",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "https://github.com/acme/hugecode",
    });
  });

  it("prefers the workspace git remote when it is available", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/pull/17",
        gitRemoteUrl: "https://github.com/acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "https://github.com/acme/hugecode.git",
    });
  });

  it("keeps SSH remotes while still resolving canonical repo identity", () => {
    expect(
      resolveRepoContext({
        sourceUrl: "https://github.com/acme/hugecode/issues/42",
        gitRemoteUrl: "git@github.com:acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "git@github.com:acme/hugecode.git",
    });
  });

  it("parses SSH remotes even without a source URL fallback", () => {
    expect(
      resolveRepoContext({
        gitRemoteUrl: "git@github.com:acme/hugecode.git",
      })
    ).toEqual({
      owner: "acme",
      name: "hugecode",
      fullName: "acme/hugecode",
      remoteUrl: "git@github.com:acme/hugecode.git",
    });
  });
});
