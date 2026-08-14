import { format } from "date-fns";

// AG-COMMENT: Date formatter that formats timestamps as-is without adding/shifting timezone offsets (+8 / UTC)
export function formatTimestampAsIs(
  dateStr: string | null | undefined,
  pattern: string = "MMM d, yyyy, hh:mm a"
): string {
  if (!dateStr) return "-";
  try {
    const str = String(dateStr).trim();
    if (!str) return "-";

    // Match YYYY-MM-DD (and optional HH:mm:ss) directly from string
    const match = str.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/
    );

    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hours = match[4] ? parseInt(match[4], 10) : 0;
      const minutes = match[5] ? parseInt(match[5], 10) : 0;
      const seconds = match[6] ? parseInt(match[6], 10) : 0;

      const localDate = new Date(year, month, day, hours, minutes, seconds);
      return format(localDate, pattern);
    }

    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return format(d, pattern);
  } catch {
    return String(dateStr);
  }
}
