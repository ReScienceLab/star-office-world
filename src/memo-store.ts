/**
 * Star Office World — Memo persistence
 *
 * Stores daily memo entries as JSON files in the memory directory.
 */

import fs from "node:fs";
import path from "node:path";
import type { MemoEntry, DailyMemo } from "./types.js";

export class MemoStore {
  private dir: string;

  constructor(memoryDir: string) {
    this.dir = memoryDir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private filePath(date: string): string {
    return path.join(this.dir, `${date}.json`);
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private yesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Append a memo entry to today's file.
   */
  append(entry: MemoEntry): void {
    const date = this.todayStr();
    const filePath = this.filePath(date);
    let entries: MemoEntry[] = [];
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch {
      entries = [];
    }
    entries.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
  }

  /**
   * Load today's memo entries.
   */
  getToday(): MemoEntry[] {
    return this.loadDate(this.todayStr());
  }

  /**
   * Load yesterday's memo as a DailyMemo, or the most recent available.
   */
  getYesterday(): DailyMemo | null {
    const yesterday = this.yesterdayStr();
    const entries = this.loadDate(yesterday);
    if (entries.length > 0) {
      return { date: yesterday, entries };
    }

    // Fallback: find most recent file before today
    try {
      const today = this.todayStr();
      const files = fs
        .readdirSync(this.dir)
        .filter((f) => f.endsWith(".json") && f < `${today}.json`)
        .sort()
        .reverse();
      if (files.length > 0) {
        const date = files[0]!.replace(".json", "");
        const fallback = this.loadDate(date);
        if (fallback.length > 0) return { date, entries: fallback };
      }
    } catch {
      // ignore
    }
    return null;
  }

  private loadDate(date: string): MemoEntry[] {
    try {
      const raw = fs.readFileSync(this.filePath(date), "utf-8");
      const entries = JSON.parse(raw);
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  }
}
