import { describe, it, expect, vi } from 'vitest';
import { resolveAvatarUrls, getInitials } from './avatar.utils';

describe('getInitials', () => {
  it('should return initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should return initials from email', () => {
    expect(getInitials('john@example.com')).toBe('JE');
  });

  it('should return single char for single word', () => {
    expect(getInitials('Admin')).toBe('A');
  });

  it('should cap at 2 characters for long names', () => {
    expect(getInitials('John Paul Doe')).toBe('JP');
  });

  it('should uppercase initials', () => {
    expect(getInitials('alice bob')).toBe('AB');
  });
});

describe('resolveAvatarUrls', () => {
  const createMockClient = (signedUrls: { signedUrl: string; error: null }[]) => ({
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrls: vi.fn().mockResolvedValue({
          data: signedUrls,
          error: null,
        }),
      }),
    },
  });

  it('should skip empty arrays', async () => {
    const client = createMockClient([]);
    await resolveAvatarUrls(client as any, []);
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('should skip items with null avatar_url', async () => {
    const client = createMockClient([]);
    const items = [{ avatar_url: null }, { avatar_url: null }];
    await resolveAvatarUrls(client as any, items);
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('should skip items with full URL avatar_url', async () => {
    const client = createMockClient([]);
    const items = [{ avatar_url: 'https://example.com/avatar.jpg' }];
    await resolveAvatarUrls(client as any, items);
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('should resolve storage paths to signed URLs', async () => {
    const client = createMockClient([
      { signedUrl: 'https://signed-url.com/user1', error: null },
    ]);
    const items = [{ avatar_url: 'user1/avatar' }];

    await resolveAvatarUrls(client as any, items);

    expect(client.storage.from).toHaveBeenCalledWith('avatars');
    expect(items[0].avatar_url).toBe('https://signed-url.com/user1');
  });

  it('should deduplicate paths and resolve all matching items', async () => {
    const client = createMockClient([
      { signedUrl: 'https://signed-url.com/user1', error: null },
    ]);
    const items = [
      { avatar_url: 'user1/avatar' },
      { avatar_url: 'user1/avatar' },
      { avatar_url: 'user1/avatar' },
    ];

    await resolveAvatarUrls(client as any, items);

    const createSignedUrls = client.storage.from('avatars').createSignedUrls;
    expect(createSignedUrls).toHaveBeenCalledWith(['user1/avatar'], 3600);
    expect(items[0].avatar_url).toBe('https://signed-url.com/user1');
    expect(items[1].avatar_url).toBe('https://signed-url.com/user1');
    expect(items[2].avatar_url).toBe('https://signed-url.com/user1');
  });

  it('should handle API errors gracefully', async () => {
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrls: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Storage error' },
          }),
        }),
      },
    };
    const items = [{ avatar_url: 'user1/avatar' }];

    await resolveAvatarUrls(client as any, items);

    expect(items[0].avatar_url).toBe('user1/avatar');
  });

  it('should handle mixed items (null, full URL, storage path)', async () => {
    const client = createMockClient([
      { signedUrl: 'https://signed-url.com/user2', error: null },
    ]);
    const items = [
      { avatar_url: null },
      { avatar_url: 'https://example.com/existing.jpg' },
      { avatar_url: 'user2/avatar' },
    ];

    await resolveAvatarUrls(client as any, items);

    expect(items[0].avatar_url).toBeNull();
    expect(items[1].avatar_url).toBe('https://example.com/existing.jpg');
    expect(items[2].avatar_url).toBe('https://signed-url.com/user2');
  });
});
