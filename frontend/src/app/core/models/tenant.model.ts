export type AuthMethod = 'azure_sso' | 'email_password' | 'magic_link';

export interface TenantResolution {
  tenant_name: string | null;
  auth_methods: AuthMethod[];
}
