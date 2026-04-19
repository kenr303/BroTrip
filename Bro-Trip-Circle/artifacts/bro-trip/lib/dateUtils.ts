/** Validate "HH:MM AM/PM" time format */
export function isValidTime(t: string): boolean {
  return /^(0?[1-9]|1[0-2]):\d{2}\s?(AM|PM)$/i.test(t.trim());
}

/** Convert "H:MM AM/PM" to minutes since midnight for reliable numeric sorting. */
export function timeToMinutes(t: string): number {
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "AM" && h === 12) h = 0;
  if (meridiem === "PM" && h !== 12) h += 12;
  return h * 60 + m;
}

/** Validate "MM/DD/YYYY" date format */
export function isValidDate(d: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(d.trim())) return false;
  const [m, day, y] = d.split("/").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
}

/**
 * Compute actual Date for an activity given the circle's trip start date,
 * the day number (1-based), and the time string ("HH:MM AM/PM").
 * Falls back to now if parsing fails.
 */
export function activityDate(startDateStr: string, dayNum: number, timeStr: string): Date {
  const fallback = new Date();
  if (!startDateStr || !isValidDate(startDateStr)) return fallback;
  const [m, d, y] = startDateStr.split("/").map(Number);
  const base = new Date(y, m - 1, d + (dayNum - 1));
  if (timeStr && isValidTime(timeStr)) {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
    if (match) {
      let hours = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      base.setHours(hours, mins, 0, 0);
    }
  }
  return base;
}

/** Format a date string as relative time (e.g. "5m ago", "2h ago") */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
