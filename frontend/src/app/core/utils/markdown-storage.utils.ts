import { SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URI_PREFIX = 'supabase-storage://';
const STORAGE_URI_REGEX = /supabase-storage:\/\/([^\s)]+)/g;
const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Extract all `supabase-storage://` paths from markdown content.
 * Returns a deduplicated array of storage paths.
 */
export function extractStoragePaths(markdown: string): string[] {
  if (!markdown) return [];
  const paths = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(STORAGE_URI_REGEX.source, 'g');
  while ((match = regex.exec(markdown)) !== null) {
    paths.add(match[1]);
  }
  return [...paths];
}

/**
 * Resolve all `supabase-storage://` URIs in markdown to signed URLs.
 * Returns the markdown with URIs replaced by signed URLs.
 * Paths that fail to resolve are replaced with a placeholder.
 */
export async function resolveMarkdownStorageUrls(
  client: SupabaseClient,
  markdown: string,
): Promise<string> {
  const paths = extractStoragePaths(markdown);
  if (paths.length === 0) return markdown;

  const { data, error } = await client.storage
    .from('course-files')
    .createSignedUrls(paths, SIGNED_URL_TTL);

  if (error || !data) return markdown;

  const urlMap = new Map<string, string>();
  for (const item of data) {
    if (item.signedUrl && !item.error) {
      urlMap.set(item.path!, item.signedUrl);
    }
  }

  return markdown.replace(STORAGE_URI_REGEX, (fullMatch, path: string) => {
    return urlMap.get(path) ?? fullMatch;
  });
}
