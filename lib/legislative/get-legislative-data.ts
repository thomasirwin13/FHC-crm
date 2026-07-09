import 'server-only';
import fs from 'fs';
import path from 'path';
import type { TrackedBill, DashboardContent } from './types';

const DATA_DIR = path.join(process.cwd(), 'lib', 'legislative', 'data');

function readJson<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

export function getTrackedBills(): TrackedBill[] {
  return readJson<TrackedBill[]>('bills.json');
}

export function getDashboardContent(): DashboardContent {
  return readJson<DashboardContent>('dashboard-content.json');
}

/** Whole-day difference between an ISO date string and today (positive = in the past). */
export function daysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
    Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) / msPerDay);
}
