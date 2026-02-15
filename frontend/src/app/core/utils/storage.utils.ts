/**
 * Returns true if the given URL is a Supabase Storage path (not a full URL).
 * Storage paths don't start with http:// or https://.
 * Null/empty values return false.
 */
export function isStoragePath(url: string | null | undefined): boolean {
  if (!url) return false;
  return !url.startsWith('http://') && !url.startsWith('https://');
}
