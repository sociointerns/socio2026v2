export type UserRoleRow = {
  id: string | number;
  name: string | null;
  email: string;
  created_at: string | null;
  department_id: string | null;
  school_id: string | null;
  campus: string | null;
  venue_id: string | null;
  university_role: string | null;
  access: UserAccessPayload;
};

export type DepartmentOption = {
  id: string;
  department_name: string;
  school: string | null;
};

export type SchoolOption = {
  id: string;
  name: string;
};

export type VenueOption = {
  id: string;
  name: string;
  campus: string | null;
};

export type UserAccessPayload = {
  is_organiser: boolean;
  is_volunteer: boolean;
  is_venue_manager: boolean;
  is_hod: boolean;
  is_dean: boolean;
  is_cfo: boolean;
  is_finance_officer: boolean;
  is_masteradmin: boolean;
  department_id: string | null;
  school_id: string | null;
  campus: string | null;
  venue_id: string | null;
};

export type RolesAnalytics = {
  totalEstimatedRevenue: number;
  venueUtilizationRate: number;
  averageApprovalSlaHours: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  venueUsage: Array<{
    venue: string;
    events: number;
  }>;
  approvalSlaByMonth: Array<{
    month: string;
    hours: number;
  }>;
};

export type RolesPageData = {
  users: UserRoleRow[];
  departments: DepartmentOption[];
  schools: SchoolOption[];
  campuses: string[];
  venues: VenueOption[];
  analytics: RolesAnalytics;
};

export type UpdateUserAccessActionResult =
  | {
      ok: true;
      user: UserRoleRow;
    }
  | {
      ok: false;
      error: string;
    };

export type DeleteUserActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };
