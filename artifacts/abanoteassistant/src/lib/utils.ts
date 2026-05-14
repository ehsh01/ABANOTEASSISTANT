import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function formatSessionDate(dateStr: string | undefined | null, fallback = "Not set"): string {
  if (!dateStr) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [m, d, y] = dateStr.split("/").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return dateStr;
}

/**
 * Format an authorization-expires value (ISO `yyyy-MM-dd` from the API) for the client cards / detail header.
 * Returns null when the input is missing/unparseable so callers can hide the badge.
 */
export function formatAuthorizationExpiresOn(raw: string | null | undefined): {
  display: string;
  isPast: boolean;
} | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  let y: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    [y, m, d] = t.split("-").map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
    const [mo, da, yr] = t.split("/").map(Number);
    y = yr;
    m = mo;
    d = da;
  } else {
    return null;
  }
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const display = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { display, isPast: dt < today };
}

/** Display-only session clock range when the API stores duration in hours only. */
export function sessionTimeRangeFromHours(sessionHours: number): { startTime: string; endTime: string } {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + Math.max(1, sessionHours), start.getMinutes(), 0, 0);
  const tf = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return { startTime: tf.format(start), endTime: tf.format(end) };
}
