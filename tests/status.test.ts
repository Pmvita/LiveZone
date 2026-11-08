import { describe, it, expect } from "vitest";
import { mapStatus, statusLabel, compareGames } from "../lib/status";

describe("mapStatus", () => {
  it("maps live codes", () => {
    for (const c of ["1H", "HT", "2H", "Q1", "Q4", "OT"]) expect(mapStatus(c)).toBe("live");
  });
  it("maps scheduled/finished/other", () => {
    expect(mapStatus("NS")).toBe("scheduled");
    expect(mapStatus("FT")).toBe("finished");
    expect(mapStatus("PST")).toBe("other");
  });
});

describe("statusLabel", () => {
  it("HT -> LIVE HT", () => expect(statusLabel("HT", 45, "live")).toBe("LIVE HT"));
  it("live elapsed", () => expect(statusLabel("1H", 34, "live")).toBe("LIVE 34'"));
  it("FT", () => expect(statusLabel("FT", 90, "finished")).toBe("FT"));
});

describe("compareGames", () => {
  it("live before scheduled", () => {
    const live = { status: "live" } as any;
    const sched = { status: "scheduled" } as any;
    expect(compareGames(live, sched)).toBeLessThan(0);
  });
});
