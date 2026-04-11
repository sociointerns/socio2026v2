export const ROLE_CODES = Object.freeze({
  MASTER_ADMIN: "MASTER_ADMIN",
  SUPPORT: "SUPPORT",
  HOD: "HOD",
  DEAN: "DEAN",
  CFO: "CFO",
  ACCOUNTS: "ACCOUNTS",
  ORGANIZER_TEACHER: "ORGANIZER_TEACHER",
  ORGANIZER_STUDENT: "ORGANIZER_STUDENT",
  ORGANIZER_VOLUNTEER: "ORGANIZER_VOLUNTEER",
  SERVICE_IT: "SERVICE_IT",
  SERVICE_VENUE: "SERVICE_VENUE",
  SERVICE_CATERING: "SERVICE_CATERING",
  SERVICE_STALLS: "SERVICE_STALLS",
  SERVICE_SECURITY: "SERVICE_SECURITY",
});

export const SERVICE_ROLE_CODES = Object.freeze([
  ROLE_CODES.SERVICE_IT,
  ROLE_CODES.SERVICE_VENUE,
  ROLE_CODES.SERVICE_CATERING,
  ROLE_CODES.SERVICE_STALLS,
  ROLE_CODES.SERVICE_SECURITY,
]);

const SERVICE_ROLE_SET = new Set(SERVICE_ROLE_CODES);
const ASSIGNMENT_FALLBACK_ROLE_SET = new Set([
  ROLE_CODES.ORGANIZER_STUDENT,
  ROLE_CODES.ORGANIZER_VOLUNTEER,
  ...SERVICE_ROLE_CODES,
]);

export const normalizeRoleCode = (roleCode) =>
  String(roleCode || "").trim().toUpperCase();

export const isRoleAssignmentActive = (assignment, nowDate = new Date()) => {
  if (!assignment || assignment.is_active === false) {
    return false;
  }

  const now = nowDate.getTime();
  const validFrom = assignment.valid_from ? new Date(assignment.valid_from).getTime() : null;
  const validUntil = assignment.valid_until ? new Date(assignment.valid_until).getTime() : null;

  if (Number.isFinite(validFrom) && validFrom > now) {
    return false;
  }

  if (Number.isFinite(validUntil) && validUntil <= now) {
    return false;
  }

  return true;
};

export const deriveRoleCodesFromAssignments = (assignments = []) => {
  const unique = new Set();

  for (const assignment of assignments) {
    if (!isRoleAssignmentActive(assignment)) {
      continue;
    }

    const normalizedRoleCode = normalizeRoleCode(assignment.role_code);
    if (normalizedRoleCode) {
      unique.add(normalizedRoleCode);
    }
  }

  return Array.from(unique);
};

export const deriveRoleCodesFromUserRecord = (userRecord = null) => {
  const roleCodes = new Set();
  const normalizedUniversityRole = String(userRecord?.university_role || "")
    .trim()
    .toLowerCase();

  if (Boolean(userRecord?.is_masteradmin) || normalizedUniversityRole === "masteradmin") {
    roleCodes.add(ROLE_CODES.MASTER_ADMIN);
  }

  if (
    Boolean(userRecord?.is_organiser) ||
    normalizedUniversityRole === "organiser" ||
    normalizedUniversityRole === "organizer_teacher"
  ) {
    roleCodes.add(ROLE_CODES.ORGANIZER_TEACHER);
  }

  if (Boolean(userRecord?.is_support) || normalizedUniversityRole === "support") {
    roleCodes.add(ROLE_CODES.SUPPORT);
  }

  if (Boolean(userRecord?.is_hod) || normalizedUniversityRole === "hod") {
    roleCodes.add(ROLE_CODES.HOD);
  }

  if (Boolean(userRecord?.is_dean) || normalizedUniversityRole === "dean") {
    roleCodes.add(ROLE_CODES.DEAN);
  }

  if (Boolean(userRecord?.is_cfo) || normalizedUniversityRole === "cfo") {
    roleCodes.add(ROLE_CODES.CFO);
  }

  if (
    Boolean(userRecord?.is_finance_officer) ||
    normalizedUniversityRole === "finance_officer" ||
    normalizedUniversityRole === "accounts"
  ) {
    roleCodes.add(ROLE_CODES.ACCOUNTS);
  }

  return Array.from(roleCodes);
};

export const deriveFallbackRoleCodesFromAssignments = (assignments = []) => {
  return deriveRoleCodesFromAssignments(assignments).filter((roleCode) =>
    ASSIGNMENT_FALLBACK_ROLE_SET.has(normalizeRoleCode(roleCode))
  );
};

export const combineRoleCodes = (primaryRoleCodes = [], fallbackRoleCodes = []) => {
  const unique = new Set([
    ...(primaryRoleCodes || []).map(normalizeRoleCode),
    ...(fallbackRoleCodes || []).map(normalizeRoleCode),
  ]);

  return Array.from(unique).filter(Boolean);
};

export const hasAnyRoleCode = (roleCodes = [], requiredRoleCodes = []) => {
  const userRoles = new Set((roleCodes || []).map(normalizeRoleCode).filter(Boolean));

  for (const requiredRoleCode of requiredRoleCodes || []) {
    if (userRoles.has(normalizeRoleCode(requiredRoleCode))) {
      return true;
    }
  }

  return false;
};

export const isServiceRoleCode = (roleCode) => SERVICE_ROLE_SET.has(normalizeRoleCode(roleCode));

export const deriveLegacyFlagsFromRoleCodes = (roleCodes = [], fallbackUser = null) => {
  const roleSet = new Set((roleCodes || []).map(normalizeRoleCode).filter(Boolean));

  const hasMasterAdminRole = roleSet.has(ROLE_CODES.MASTER_ADMIN);
  const hasOrganizerTeacherRole = roleSet.has(ROLE_CODES.ORGANIZER_TEACHER);
  const hasSupportRole = roleSet.has(ROLE_CODES.SUPPORT);
  const hasHodRole = roleSet.has(ROLE_CODES.HOD);
  const hasDeanRole = roleSet.has(ROLE_CODES.DEAN);
  const hasCfoRole = roleSet.has(ROLE_CODES.CFO);
  const hasFinanceOfficerRole = roleSet.has(ROLE_CODES.ACCOUNTS);

  return {
    is_masteradmin: Boolean(fallbackUser?.is_masteradmin) || hasMasterAdminRole,
    is_organiser: Boolean(fallbackUser?.is_organiser) || hasOrganizerTeacherRole,
    is_support: Boolean(fallbackUser?.is_support) || hasSupportRole,
    is_hod: Boolean(fallbackUser?.is_hod) || hasHodRole,
    is_dean: Boolean(fallbackUser?.is_dean) || hasDeanRole,
    is_cfo: Boolean(fallbackUser?.is_cfo) || hasCfoRole,
    is_finance_officer: Boolean(fallbackUser?.is_finance_officer) || hasFinanceOfficerRole,
  };
};
