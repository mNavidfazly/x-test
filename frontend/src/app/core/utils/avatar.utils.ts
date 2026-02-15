import { SupabaseClient } from '@supabase/supabase-js';
import { isStoragePath } from './storage.utils';

/**
 * Batch-resolve avatar_url storage paths to signed URLs.
 * Deduplicates by path, calls createSignedUrls once, mutates items in-place.
 * Items with null/undefined avatar_url or full URLs are skipped.
 */
export async function resolveAvatarUrls<T extends { avatar_url: string | null }>(
  client: SupabaseClient,
  items: T[],
): Promise<void> {
  const pathToIndices = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    const url = items[i].avatar_url;
    if (url && isStoragePath(url)) {
      const indices = pathToIndices.get(url) ?? [];
      indices.push(i);
      pathToIndices.set(url, indices);
    }
  }

  if (pathToIndices.size === 0) return;

  const uniquePaths = Array.from(pathToIndices.keys());
  const { data, error } = await client.storage
    .from('avatars')
    .createSignedUrls(uniquePaths, 3600);

  if (error || !data) return;

  for (let i = 0; i < uniquePaths.length; i++) {
    const result = data[i];
    if (result && !result.error && result.signedUrl) {
      const indices = pathToIndices.get(uniquePaths[i])!;
      for (const idx of indices) {
        items[idx].avatar_url = result.signedUrl;
      }
    }
  }
}

/**
 * Compute 1-2 character initials from a name or email.
 * Splits on whitespace and '@', takes first char of each part.
 */
export function getInitials(name: string): string {
  return name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}
