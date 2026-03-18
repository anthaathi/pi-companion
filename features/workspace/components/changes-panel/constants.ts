export type Tab = "changes" | "files" | "history";

export const STATUS_COLORS: Record<string, string> = {
  M: "#C4A000",
  A: "#26A269",
  D: "#E5484D",
  R: "#3B82F6",
  C: "#3B82F6",
  U: "#9CA3AF",
  "?": "#9CA3AF",
};

export function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase();
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
