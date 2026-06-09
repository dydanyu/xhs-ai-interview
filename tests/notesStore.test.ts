import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendNotes,
  loadNotes,
  getUnanswered,
  markAnswered,
} from "../src/store/notesStore.js";
import type { XhsNote } from "../src/types.js";

function makeNote(id: string, answered = false): XhsNote {
  return {
    noteId: id,
    title: `t-${id}`,
    content: `c-${id}`,
    url: `https://xhs/${id}`,
    keyword: "AI Agent 面试",
    fetchedAt: "2026-06-09T00:00:00.000Z",
    answered,
  };
}

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "notes-"));
  file = join(dir, "notes.jsonl");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("notesStore", () => {
  it("appends notes and dedupes by noteId", () => {
    const r1 = appendNotes(file, [makeNote("a"), makeNote("b")]);
    expect(r1).toEqual({ added: 2, skipped: 0 });
    const r2 = appendNotes(file, [makeNote("b"), makeNote("c")]);
    expect(r2).toEqual({ added: 1, skipped: 1 });
    expect(loadNotes(file).map((n) => n.noteId)).toEqual(["a", "b", "c"]);
  });

  it("loads empty array when file missing", () => {
    expect(loadNotes(file)).toEqual([]);
  });

  it("returns only unanswered notes", () => {
    appendNotes(file, [makeNote("a"), makeNote("b", true)]);
    expect(getUnanswered(file).map((n) => n.noteId)).toEqual(["a"]);
  });

  it("marks notes answered", () => {
    appendNotes(file, [makeNote("a"), makeNote("b")]);
    markAnswered(file, ["a"]);
    expect(getUnanswered(file).map((n) => n.noteId)).toEqual(["b"]);
  });
});
