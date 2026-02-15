export interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
}

export interface FullProfileData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tenant_id: string;
  tenant_name: string;
  is_tenant_admin: boolean;
  is_platform_admin: boolean;
  created_at: string;
}
