export type AuthMethod = 'email_password' | 'magic_link' | 'keycloak_sso';

export interface TenantResolution {
  tenant_name: string | null;
  auth_methods: AuthMethod[];
  idp_hint: string | null;
}
