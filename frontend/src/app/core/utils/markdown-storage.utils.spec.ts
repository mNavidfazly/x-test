import { describe, it, expect, vi } from 'vitest';
import { extractStoragePaths, resolveMarkdownStorageUrls } from './markdown-storage.utils';

describe('extractStoragePaths', () => {
  it('should return empty array for empty string', () => {
    expect(extractStoragePaths('')).toEqual([]);
  });

  it('should return empty array for null/undefined', () => {
    expect(extractStoragePaths(null as unknown as string)).toEqual([]);
    expect(extractStoragePaths(undefined as unknown as string)).toEqual([]);
  });

  it('should extract a single storage path', () => {
    const md = '![image](supabase-storage://course-1/markdown-images/123-photo.webp)';
    expect(extractStoragePaths(md)).toEqual(['course-1/markdown-images/123-photo.webp']);
  });

  it('should extract multiple storage paths', () => {
    const md = `
Some text ![a](supabase-storage://path/a.webp) more text
![b](supabase-storage://path/b.webp)
    `;
    expect(extractStoragePaths(md)).toEqual(['path/a.webp', 'path/b.webp']);
  });

  it('should deduplicate paths', () => {
    const md = '![a](supabase-storage://path/a.webp) ![b](supabase-storage://path/a.webp)';
    expect(extractStoragePaths(md)).toEqual(['path/a.webp']);
  });

  it('should not extract regular URLs', () => {
    const md = '![image](https://example.com/photo.jpg)';
    expect(extractStoragePaths(md)).toEqual([]);
  });

  it('should handle markdown with no storage URIs', () => {
    const md = '# Hello World\n\nSome plain text content.';
    expect(extractStoragePaths(md)).toEqual([]);
  });
});

describe('resolveMarkdownStorageUrls', () => {
  it('should return original markdown when no storage URIs', async () => {
    const md = '# Hello World';
    const client = {} as any;
    const result = await resolveMarkdownStorageUrls(client, md);
    expect(result).toBe(md);
  });

  it('should replace storage URIs with signed URLs', async () => {
    const md = '![photo](supabase-storage://course-1/img/photo.webp)';
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrls: vi.fn().mockResolvedValue({
            data: [{ path: 'course-1/img/photo.webp', signedUrl: 'https://signed.url/photo.webp?token=abc', error: null }],
            error: null,
          }),
        }),
      },
    } as any;

    const result = await resolveMarkdownStorageUrls(client, md);
    expect(result).toBe('![photo](https://signed.url/photo.webp?token=abc)');
    expect(client.storage.from).toHaveBeenCalledWith('course-files');
  });

  it('should handle batch resolution of multiple paths', async () => {
    const md = '![a](supabase-storage://p/a.webp) ![b](supabase-storage://p/b.webp)';
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrls: vi.fn().mockResolvedValue({
            data: [
              { path: 'p/a.webp', signedUrl: 'https://signed/a', error: null },
              { path: 'p/b.webp', signedUrl: 'https://signed/b', error: null },
            ],
            error: null,
          }),
        }),
      },
    } as any;

    const result = await resolveMarkdownStorageUrls(client, md);
    expect(result).toBe('![a](https://signed/a) ![b](https://signed/b)');
  });

  it('should keep original URI when resolution fails', async () => {
    const md = '![photo](supabase-storage://course-1/img/photo.webp)';
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrls: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      },
    } as any;

    const result = await resolveMarkdownStorageUrls(client, md);
    expect(result).toBe(md);
  });

  it('should leave external URLs untouched', async () => {
    const md = '![ext](https://example.com/img.jpg) ![storage](supabase-storage://p/img.webp)';
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrls: vi.fn().mockResolvedValue({
            data: [{ path: 'p/img.webp', signedUrl: 'https://signed/img', error: null }],
            error: null,
          }),
        }),
      },
    } as any;

    const result = await resolveMarkdownStorageUrls(client, md);
    expect(result).toBe('![ext](https://example.com/img.jpg) ![storage](https://signed/img)');
  });
});
