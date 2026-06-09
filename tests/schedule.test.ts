import { describe, it, expect } from "vitest";
import { buildCrontab, stripManaged, MARKER } from "../src/schedule.js";

const DAILY = "/proj/scripts/daily.sh";

describe("buildCrontab", () => {
  it("adds a managed line to an empty crontab", () => {
    const out = buildCrontab("", "0 9 * * *", DAILY);
    expect(out).toBe(`0 9 * * * ${DAILY} ${MARKER}\n`);
  });

  it("preserves unrelated existing entries", () => {
    const existing = "*/5 * * * * /other/job.sh\n";
    const out = buildCrontab(existing, "0 9 * * *", DAILY);
    expect(out).toContain("*/5 * * * * /other/job.sh");
    expect(out).toContain(`0 9 * * * ${DAILY} ${MARKER}`);
  });

  it("is idempotent: replaces old managed line instead of duplicating", () => {
    const first = buildCrontab("", "0 9 * * *", DAILY);
    const second = buildCrontab(first, "30 8 * * *", DAILY);
    expect(second.match(new RegExp(MARKER, "g"))?.length).toBe(1);
    expect(second).toContain(`30 8 * * * ${DAILY} ${MARKER}`);
    expect(second).not.toContain("0 9 * * *");
  });
});

describe("stripManaged", () => {
  it("removes only managed lines", () => {
    const existing = `*/5 * * * * /other/job.sh\n0 9 * * * ${DAILY} ${MARKER}\n`;
    expect(stripManaged(existing).trim()).toBe("*/5 * * * * /other/job.sh");
  });
});
