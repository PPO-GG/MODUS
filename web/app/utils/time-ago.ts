/** Compact relative time: "just now", "40m", "9h", "2d". */
export function timeAgo(date: string | Date, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(date).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Compact duration from minutes, rounded down: "45m", "2h", "7d". */
export function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}
