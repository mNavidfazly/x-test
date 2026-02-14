/**
 * Extracts a human-readable message from unknown error shapes.
 * Handles: Error instances, Supabase error objects ({message}), and fallback.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err)
    return String((err as { message: unknown }).message);
  return fallback;
}
