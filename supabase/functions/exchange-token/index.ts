import "@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "npm:jose@5";

const KEYCLOAK_ISSUER = "https://dev-auth.x-lng.com/realms/customers";
const KEYCLOAK_JWKS_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`;
const TOKEN_TTL_SECONDS = 3600;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JWKS = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URL));

function jsonError(message: string, status = 401): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function querySupabase(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
): Promise<unknown> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Missing Keycloak token");
    }

    const keycloakToken = authHeader.slice(7);

    const { payload } = await jwtVerify(keycloakToken, JWKS, {
      issuer: KEYCLOAK_ISSUER,
    });

    const keycloakSub = payload.sub;
    if (!keycloakSub) return jsonError("No sub claim in Keycloak token");

    const jwtSecret = Deno.env.get("KC_JWT_SECRET");
    if (!jwtSecret) return jsonError("KC_JWT_SECRET not configured", 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const email = payload.email as string | undefined;

    let sub = keycloakSub;
    const claims: Record<string, unknown> = {
      role: "authenticated",
      email: email ?? "",
    };

    if (email) {
      const profiles = (await querySupabase(
        supabaseUrl,
        serviceRoleKey,
        `profiles?email=eq.${encodeURIComponent(email)}&select=id,tenant_id,is_platform_admin,is_tenant_admin&limit=1`,
      )) as Array<{
        id: string;
        tenant_id: string;
        is_platform_admin: boolean;
        is_tenant_admin: boolean;
      }> | null;

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        // Use the Supabase profile ID so auth.uid() matches in RLS
        sub = profile.id;
        claims.tenant_id = profile.tenant_id ?? "";
        claims.is_tenant_admin = profile.is_tenant_admin ?? false;
        claims.is_platform_admin = profile.is_platform_admin ?? false;

        // CSM tenant assignments
        const csmRows = (await querySupabase(
          supabaseUrl,
          serviceRoleKey,
          `csm_tenant_assignments?user_id=eq.${profile.id}&select=tenant_id`,
        )) as Array<{ tenant_id: string }> | null;
        claims.csm_tenant_ids = csmRows?.map((r) => r.tenant_id) ?? [];

        // Lecturer course assignments
        const lecturerRows = (await querySupabase(
          supabaseUrl,
          serviceRoleKey,
          `lecturer_course_assignments?user_id=eq.${profile.id}&select=course_id,can_edit,can_grade`,
        )) as Array<{
          course_id: string;
          can_edit: boolean;
          can_grade: boolean;
        }> | null;
        claims.lecturer_course_ids =
          lecturerRows?.map((r) => r.course_id) ?? [];
        claims.lecturer_can_edit_course_ids =
          lecturerRows
            ?.filter((r) => r.can_edit)
            .map((r) => r.course_id) ?? [];
        claims.lecturer_can_grade_course_ids =
          lecturerRows
            ?.filter((r) => r.can_grade)
            .map((r) => r.course_id) ?? [];
      }
    }

    const supabaseJwt = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(sub)
      .setIssuer("supabase")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(jwtSecret));

    return new Response(
      JSON.stringify({ token: supabaseJwt, expires_in: TOKEN_TTL_SECONDS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(message);
  }
});
