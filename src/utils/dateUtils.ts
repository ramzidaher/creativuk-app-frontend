/**
 * Format an ISO 8601 or Date for display: e.g. "10 Mar 2025, 2:00 PM".
 * Use for opportunity scheduledAt and similar date/time fields.
 */
export function formatScheduledAtDisplay(iso: string | Date | null | undefined): string {
  if (iso == null) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
