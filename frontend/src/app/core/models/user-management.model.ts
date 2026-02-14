export interface UserForBoard {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_tenant_admin: boolean;
  is_platform_admin: boolean;
  tenant_id: string;
  tenant_name: string;
  created_at: string;
  updated_at: string;
}

export interface InviteUserData {
  email: string;
  tenant_id?: string;
}

export interface UpdateUserRolesData {
  is_tenant_admin?: boolean;
  is_platform_admin?: boolean;
}

export interface UpdateUserProfileData {
  full_name: string;
}
