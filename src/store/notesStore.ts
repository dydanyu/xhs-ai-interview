import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { XhsNote } from "../types.js";

export function loadNotes(file: string): XhsNote[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as XhsNote);
}

function saveNotes(file: string, notes: XhsNote[]): void {
  mkdirSync(dirname(file), { recursive: true });
  const body = notes.map((n) => JSON.stringify(n)).join("\n");
  writeFileSync(file, body.length ? body + "\n" : "", "utf8");
}

export function appendNotes(
  file: string,
  incoming: XhsNote[]
): { added: number; skipped: number } {
  const existing = loadNotes(file);
  const seen = new Set(existing.map((n) => n.noteId));
  let added = 0;
  let skipped = 0;
  for (const note of incoming) {
    if (seen.has(note.noteId)) {
      skipped++;
      continue;
    }
    seen.add(note.noteId);
    existing.push(note);
    added++;
  }
  saveNotes(file, existing);
  return { added, skipped };
}

export function getUnanswered(file: string): XhsNote[] {
  return loadNotes(file).filter((n) => !n.answered);
}

export function markAnswered(file: string, ids: string[]): void {
  const idSet = new Set(ids);
  const notes = loadNotes(file).map((n) =>
    idSet.has(n.noteId) ? { ...n, answered: true } : n
  );
  saveNotes(file, notes);
}
