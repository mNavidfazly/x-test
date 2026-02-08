import { vi } from 'vitest';

export function createMockSupabaseService(options?: {
  tenantId?: string;
  isPlatformAdmin?: boolean;
  isTenantAdmin?: boolean;
  csmTenantIds?: string[];
  lecturerCourseIds?: string[];
  lecturerCanEditCourseIds?: string[];
  lecturerCanGradeCourseIds?: string[];
}) {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [], error: null }),
    ),
  };

  return {
    client: {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'test-user-id' },
              access_token: 'mock-jwt',
              _claims: {
                tenant_id: options?.tenantId ?? 'test-tenant-id',
                is_platform_admin: options?.isPlatformAdmin ?? false,
                is_tenant_admin: options?.isTenantAdmin ?? false,
                csm_tenant_ids: options?.csmTenantIds ?? [],
                lecturer_course_ids: options?.lecturerCourseIds ?? [],
                lecturer_can_edit_course_ids:
                  options?.lecturerCanEditCourseIds ?? [],
                lecturer_can_grade_course_ids:
                  options?.lecturerCanGradeCourseIds ?? [],
              },
            },
          },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: { path: 'test/file.pdf' },
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://test.supabase.co/file.pdf' },
          }),
        }),
      },
    },

    _mockQueryBuilder: mockQueryBuilder,

    _mockQueryResponse(data: unknown, error: unknown = null) {
      mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: unknown; error: unknown }) => void) =>
        resolve({ data, error }),
      );
    },

    _resetMocks() {
      Object.values(mockQueryBuilder).forEach((fn) => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as ReturnType<typeof vi.fn>).mockClear();
        }
      });
    },
  };
}

export type MockSupabaseService = ReturnType<typeof createMockSupabaseService>;
