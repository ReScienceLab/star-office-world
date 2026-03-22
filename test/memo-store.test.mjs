import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MemoStore } from "../dist/memo-store.js";

function isoDayOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

test("MemoStore construction tolerates memo directory creation failures", () => {
  const originalMkdirSync = fs.mkdirSync;
  const originalWarn = console.warn;
  const warnings = [];

  fs.mkdirSync = () => {
    throw new Error("permission denied");
  };
  console.warn = (...args) => {
    warnings.push(args);
  };

  try {
    assert.doesNotThrow(() => new MemoStore("/tmp/star-office-denied"));
    assert.equal(warnings.length, 1);
  } finally {
    fs.mkdirSync = originalMkdirSync;
    console.warn = originalWarn;
  }
});

test("MemoStore skips corrupt history files and still loads the most recent valid memo day", (t) => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "star-office-memo-store-"));
  t.after(() => {
    fs.rmSync(memoryDir, { recursive: true, force: true });
  });

  const validDate = isoDayOffset(-3);
  const corruptDate = isoDayOffset(-2);

  fs.writeFileSync(
    path.join(memoryDir, `${validDate}.json`),
    JSON.stringify([{ agentId: "agent-1", alias: "Alpha", content: "Valid memo", timestamp: 1 }]),
    "utf-8",
  );
  fs.writeFileSync(path.join(memoryDir, `${corruptDate}.json`), "{not-json", "utf-8");

  const store = new MemoStore(memoryDir);

  assert.deepEqual(store.getToday(), []);
  assert.deepEqual(store.getYesterday(), {
    date: validDate,
    entries: [{ agentId: "agent-1", alias: "Alpha", content: "Valid memo", timestamp: 1 }],
  });
});
