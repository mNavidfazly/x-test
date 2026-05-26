import { describe, it, expect, vi } from 'vitest';
import { paginateAll } from './paginate';

describe('paginateAll', () => {
  it('returns empty array when first page is empty', async () => {
    const builder = vi.fn().mockResolvedValue({ data: [], error: null });
    const result = await paginateAll<number>(builder);
    expect(result).toEqual([]);
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it('returns single page when fewer rows than page size', async () => {
    const builder = vi.fn().mockResolvedValue({ data: [1, 2, 3], error: null });
    const result = await paginateAll<number>(builder, 1000);
    expect(result).toEqual([1, 2, 3]);
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it('paginates across multiple pages until a short page', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => i);
    const page2 = Array.from({ length: 1000 }, (_, i) => i + 1000);
    const page3 = Array.from({ length: 350 }, (_, i) => i + 2000);

    const builder = vi.fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })
      .mockResolvedValueOnce({ data: page3, error: null });

    const result = await paginateAll<number>(builder, 1000);
    expect(result.length).toBe(2350);
    expect(result[0]).toBe(0);
    expect(result[2349]).toBe(2349);
    expect(builder).toHaveBeenCalledTimes(3);
    expect(builder).toHaveBeenNthCalledWith(1, 0, 999);
    expect(builder).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(builder).toHaveBeenNthCalledWith(3, 2000, 2999);
  });

  it('stops when a page exactly equals page size but next is empty', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => i);

    const builder = vi.fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await paginateAll<number>(builder, 100);
    expect(result.length).toBe(100);
    expect(builder).toHaveBeenCalledTimes(2);
  });

  it('throws on error', async () => {
    const builder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    await expect(paginateAll<number>(builder)).rejects.toEqual({ message: 'boom' });
  });

  it('throws when maxPages exceeded', async () => {
    const fullPage = Array.from({ length: 10 }, (_, i) => i);
    const builder = vi.fn().mockResolvedValue({ data: fullPage, error: null });

    await expect(paginateAll<number>(builder, 10, 3)).rejects.toThrow(/exceeded 3 pages/);
    expect(builder).toHaveBeenCalledTimes(3);
  });
});
