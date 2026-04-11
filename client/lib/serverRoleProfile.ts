import {
  getActiveRoleCodesFromAssignments,
  getRoleCodes,
  mergeRoleCodes,
} from "@/lib/roleDashboards";

type AuthUserLike = {
  id: string;
  email?: string | null;
};

export async function getCurrentUserProfileWithRoleCodes(
  supabase: any,
  authUser: AuthUserLike
): Promise<Record<string, unknown> | null> {
  const byAuthUuid = await supabase
    .from("users")
    .select("*")
    .eq("auth_uuid", authUser.id)
    .maybeSingle();

  let profile = !byAuthUuid.error && byAuthUuid.data
    ? (byAuthUuid.data as Record<string, unknown>)
    : null;

  if (!profile && authUser.email) {
    const byEmail = await supabase
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();

    if (!byEmail.error && byEmail.data) {
      profile = byEmail.data as Record<string, unknown>;
    }
  }

  if (!profile) {
    return null;
  }

  const userId = String(profile.id || "").trim();
  if (!userId) {
    return profile;
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("user_role_assignments")
    .select("role_code,is_active,valid_from,valid_until")
    .eq("user_id", userId);

  if (assignmentError || !Array.isArray(assignmentRows)) {
    return profile;
  }

  const roleCodes = mergeRoleCodes(
    getRoleCodes(profile),
    getActiveRoleCodesFromAssignments(assignmentRows as Array<Record<string, unknown>>)
  );

  if (roleCodes.length === 0) {
    return profile;
  }

  return {
    ...profile,
    role_codes: roleCodes,
  };
}
