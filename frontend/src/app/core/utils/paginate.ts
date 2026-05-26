import type { PostgrestBuilder } from '@supabase/postgrest-js';

const SUPABASE_DEFAULT_CAP = 1000;
const DEFAULT_MAX_PAGES = 50;

/**
 * Fetch every row from a Supabase query, working around the 1000-row PostgREST cap.
 *
 * Pass a FACTORY because PostgREST query builders are single-use — once `.range()`
 * has been applied, the chain can't be reused.
 *
 *   const rows = await paginateAll<{ id: string }>((from, to) =>
 *     client.from('user_progress').select('id').eq('course_id', cid).range(from, to),
 *   );
 *
 * Throws on the first batch error. Hard cap at `maxPages` to surface runaway loops.
 */
export async function paginateAll<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = SUPABASE_DEFAULT_CAP,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let page = 0;
  while (page < maxPages) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
    page++;
  }
  if (page === maxPages) {
    throw new Error(`paginateAll exceeded ${maxPages} pages (${maxPages * pageSize} rows)`);
  }
  return all;
}
