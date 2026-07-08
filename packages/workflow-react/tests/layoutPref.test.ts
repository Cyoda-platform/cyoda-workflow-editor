import { afterEach, describe, expect, it } from "vitest";
import { defaultLayoutPref, loadLayoutPref, saveLayoutPref } from "../src/components/layoutPref.js";

afterEach(() => localStorage.clear());

describe("layoutPref", () => {
  it("defaults to vertical / configuratorReadable", () => {
    expect(defaultLayoutPref()).toEqual({ orientation: "vertical", preset: "configuratorReadable" });
  });

  it("takes its defaults from the host layoutOptions", () => {
    expect(defaultLayoutPref({ orientation: "horizontal", preset: "websiteCompact" })).toEqual({
      orientation: "horizontal",
      preset: "websiteCompact",
    });
  });

  it("round-trips through localStorage under the :pref key", () => {
    saveLayoutPref("k", { orientation: "horizontal", preset: "opsAudit" });
    expect(localStorage.getItem("k:pref")).toContain("horizontal");
    expect(loadLayoutPref("k")).toEqual({ orientation: "horizontal", preset: "opsAudit" });
  });

  it("does not persist when the key is null", () => {
    saveLayoutPref(null, { orientation: "horizontal", preset: "opsAudit" });
    expect(loadLayoutPref(null)).toEqual({ orientation: "vertical", preset: "configuratorReadable" });
  });

  it("falls back on corrupt or unknown stored values", () => {
    localStorage.setItem("k:pref", JSON.stringify({ orientation: "sideways", preset: "bogus" }));
    expect(loadLayoutPref("k")).toEqual({ orientation: "vertical", preset: "configuratorReadable" });
  });
});
