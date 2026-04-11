"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import { deleteUserAccount, updateUserAccess } from "./actions";
import DomainScopeModal, { type DomainScopeMode } from "./DomainScopeModal";
import type { RolesPageData, UserAccessPayload, UserRoleRow } from "./types";

type RolesManagementTableProps = {
  initialData: RolesPageData;
};

type MatrixRole =
  | "organiser"
  | "volunteer"
  | "venue_manager"
  | "hod"
  | "dean"
  | "cfo"
  | "finance"
  | "master_admin";

type DomainModalState = {
  isOpen: boolean;
  role: DomainScopeMode;
  userId: string | number;
  userName: string;
  initialValue: string | null;
};

const domainRoleSet = new Set<MatrixRole>(["venue_manager", "hod", "dean", "cfo"]);

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

<<<<<<< Updated upstream
const sameUserId = (left: string | number, right: string | number) => String(left) === String(right);

function isRoleEnabled(access: UserAccessPayload, role: MatrixRole): boolean {
  if (role === "organiser") {
    return access.is_organiser;
=======
function normalizeRoleKey(
  rawRole: string | null,
  flags: { is_hod: boolean; is_dean: boolean; is_cfo: boolean; is_finance_officer: boolean }
): "hod" | "dean" | "cfo" | "finance_officer" | null {
  const normalized = String(rawRole || "").trim().toLowerCase();
  if (
    normalized === "hod" ||
    normalized === "dean" ||
    normalized === "cfo" ||
    normalized === "finance_officer"
  ) {
    return normalized;
>>>>>>> Stashed changes
  }

  if (role === "volunteer") {
    return access.is_volunteer;
  }

  if (role === "venue_manager") {
    return access.is_venue_manager;
  }

  if (role === "hod") {
    return access.is_hod;
  }

  if (role === "dean") {
    return access.is_dean;
  }

  if (role === "cfo") {
    return access.is_cfo;
  }

  if (role === "finance") {
    return access.is_finance_officer;
  }

  return access.is_masteradmin;
}

function domainModeFromRole(role: MatrixRole): DomainScopeMode {
  if (role === "hod") {
    return "hod";
  }

  if (role === "dean") {
    return "dean";
  }

<<<<<<< Updated upstream
  if (role === "cfo") {
    return "cfo";
  }

  return "venue_manager";
}

function roleLabel(role: MatrixRole): string {
  if (role === "organiser") {
    return "Organiser";
  }
  if (role === "volunteer") {
    return "Volunteer";
  }
  if (role === "venue_manager") {
    return "Venue Mgr";
  }
  if (role === "hod") {
    return "HOD";
  }
  if (role === "dean") {
    return "Dean";
  }
  if (role === "cfo") {
    return "CFO";
  }
  if (role === "finance") {
    return "Finance";
  }
  return "Master Admin";
}

function emptyModalState(): DomainModalState {
  return {
    isOpen: false,
    role: "hod",
    userId: "",
    userName: "",
    initialValue: null,
  };
}

function buildNextAccessPayload(
  current: UserAccessPayload,
  role: MatrixRole,
  domainSelection?: string | null
): UserAccessPayload {
  const next: UserAccessPayload = {
    ...current,
  };

  if (role === "organiser") {
    next.is_organiser = !current.is_organiser;
    return next;
  }

  if (role === "volunteer") {
    next.is_volunteer = !current.is_volunteer;
    return next;
  }

  if (role === "finance") {
    next.is_finance_officer = !current.is_finance_officer;
    return next;
  }

  if (role === "master_admin") {
    next.is_masteradmin = !current.is_masteradmin;
    return next;
  }

  const shouldEnable = !isRoleEnabled(current, role);

  next.is_hod = false;
  next.is_dean = false;
  next.is_cfo = false;
  next.is_venue_manager = false;
  next.department_id = null;
  next.school_id = null;
  next.campus = null;
  next.venue_id = null;

  if (!shouldEnable) {
    return next;
  }

  if (role === "hod") {
    next.is_hod = true;
    next.department_id = domainSelection || null;
  }

  if (role === "dean") {
    next.is_dean = true;
    next.school_id = domainSelection || null;
  }

  if (role === "cfo") {
    next.is_cfo = true;
    next.campus = domainSelection || null;
  }

  if (role === "venue_manager") {
    next.is_venue_manager = true;
    next.venue_id = domainSelection || null;
  }

  return next;
}

function domainValueForRole(access: UserAccessPayload, role: MatrixRole): string | null {
  if (role === "hod") {
    return access.department_id;
  }

  if (role === "dean") {
    return access.school_id;
  }

  if (role === "cfo") {
    return access.campus;
  }

  if (role === "venue_manager") {
    return access.venue_id;
=======
  if (flags.is_cfo) {
    return "cfo";
  }

  if (flags.is_finance_officer) {
    return "finance_officer";
>>>>>>> Stashed changes
  }

  return null;
}

function hasScopeOptions(data: RolesPageData, role: MatrixRole): boolean {
  if (role === "hod") {
    return data.departments.length > 0;
  }

  if (role === "dean") {
    return data.schools.length > 0;
  }

  if (role === "cfo") {
    return data.campuses.length > 0;
  }

  if (role === "venue_manager") {
    return data.venues.length > 0;
  }

  return true;
}

<<<<<<< Updated upstream
function resolveDomainSummary(user: UserRoleRow, data: RolesPageData): string {
  if (user.access.is_hod && user.access.department_id) {
    const department = data.departments.find((item) => item.id === user.access.department_id);
    return `HOD: ${department?.department_name || user.access.department_id}`;
  }

  if (user.access.is_dean && user.access.school_id) {
    return `Dean: ${user.access.school_id}`;
  }

  if (user.access.is_cfo && user.access.campus) {
    return `CFO: ${user.access.campus}`;
  }

  if (user.access.is_venue_manager && user.access.venue_id) {
    const venue = data.venues.find((item) => item.id === user.access.venue_id);
    return `Venue: ${venue?.name || user.access.venue_id}`;
  }

  return "-";
}

function ToggleCell({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
      />
      <span className={`text-xs font-semibold ${checked ? "text-emerald-700" : "text-slate-400"}`}>
        {checked ? "On" : "Off"}
      </span>
    </label>
  );
=======
function assignmentFromUser(user: UserRoleRow): AssignmentDraft {
  const roleKey = normalizeRoleKey(user.university_role, {
    is_hod: user.is_hod,
    is_dean: user.is_dean,
    is_cfo: user.is_cfo,
    is_finance_officer: user.is_finance_officer,
  });
  const role = roleKeyToAssignable(roleKey);

  return {
    role,
    domainId: null,
  };
>>>>>>> Stashed changes
}

export default function RolesManagementTable({ initialData }: RolesManagementTableProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"access" | "analytics">("access");
  const [users, setUsers] = useState<UserRoleRow[]>(initialData.users);
  const [searchText, setSearchText] = useState("");
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | number | null>(null);
  const [pendingUpdateUserId, setPendingUpdateUserId] = useState<string | number | null>(null);
  const [domainModal, setDomainModal] = useState<DomainModalState>(emptyModalState());
  const [pendingModalRole, setPendingModalRole] = useState<MatrixRole | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return users;
    }

    return users.filter((user) => {
      return (
        (user.name || "").toLowerCase().includes(normalized) || user.email.toLowerCase().includes(normalized)
      );
    });
  }, [users, searchText]);

<<<<<<< Updated upstream
  const runAccessUpdate = (user: UserRoleRow, nextAccess: UserAccessPayload, successMessage: string) => {
    setPendingUpdateUserId(user.id);

    startTransition(async () => {
      const response = await updateUserAccess(user.id, nextAccess);
      setPendingUpdateUserId(null);
=======
  const beginEdit = (user: UserRoleRow) => {
    setEditingUserId(user.id);
    setDraft(assignmentFromUser(user));
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setDraft(null);
  };

  const handleRoleChange = (nextRole: AssignableRole) => {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        role: nextRole,
        domainId: null,
      };
    });
  };

  const saveAssignment = (userId: string | number) => {
    if (!draft) {
      return;
    }

    startTransition(async () => {
      const response = await assignRoleAction(userId, draft.role, null);
>>>>>>> Stashed changes

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setUsers((previous) =>
        previous.map((row) => (sameUserId(row.id, user.id) ? response.user : row))
      );

      toast.success(successMessage);
      router.refresh();
    });
  };

  const handleRoleToggle = (user: UserRoleRow, role: MatrixRole) => {
    const currentlyEnabled = isRoleEnabled(user.access, role);

    if (domainRoleSet.has(role) && !currentlyEnabled) {
      if (!hasScopeOptions(initialData, role)) {
        toast.error(`No scope options available for ${roleLabel(role)}.`);
        return;
      }

      const mode = domainModeFromRole(role);
      setPendingModalRole(role);
      setDomainModal({
        isOpen: true,
        role: mode,
        userId: user.id,
        userName: user.name || user.email,
        initialValue: domainValueForRole(user.access, role),
      });
      return;
    }

    const nextAccess = buildNextAccessPayload(user.access, role);
    runAccessUpdate(user, nextAccess, `${roleLabel(role)} access updated.`);
  };

  const handleDomainConfirm = (selectedValue: string) => {
    if (!domainModal.isOpen || !pendingModalRole) {
      return;
    }

    const user = users.find((row) => sameUserId(row.id, domainModal.userId));
    if (!user) {
      setDomainModal(emptyModalState());
      setPendingModalRole(null);
      toast.error("User not found for role update.");
      return;
    }

    const nextAccess = buildNextAccessPayload(user.access, pendingModalRole, selectedValue);
    setDomainModal(emptyModalState());
    setPendingModalRole(null);
    runAccessUpdate(user, nextAccess, `${roleLabel(pendingModalRole)} access updated.`);
  };

  const requestDelete = (user: UserRoleRow) => {
    const proceed = window.confirm(`Delete ${user.email}? This cannot be undone.`);
    if (!proceed) {
      return;
    }

    setPendingDeleteUserId(user.id);

    startTransition(async () => {
      const response = await deleteUserAccount(user.id);
      setPendingDeleteUserId(null);

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setUsers((previous) => previous.filter((row) => !sameUserId(row.id, user.id)));
      toast.success("User deleted successfully.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Access Control Matrix</h2>
            <p className="mt-1 text-sm text-slate-600">
<<<<<<< Updated upstream
              Toggle Organiser, Volunteer, Venue Manager, HOD, Dean, CFO, Finance, and Master Admin access.
=======
              Assign global HOD, DEAN, CFO, or FINANCE_OFFICER roles directly on each user.
>>>>>>> Stashed changes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("access")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === "access"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Access Control
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("analytics")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === "analytics"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Global Analytics
            </button>
          </div>
        </div>
      </div>

      {activeTab === "access" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

<<<<<<< Updated upstream
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1700px] w-full border-collapse">
                <thead className="bg-slate-100/80 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Name</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Email</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Joined</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Organiser</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Volunteer</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Venue Mgr</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">HOD</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Dean</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">CFO</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Finance</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Master Admin</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Domain Scope</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                      Actions
                    </th>
=======
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse">
            <thead className="bg-slate-100/80 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Joined Date
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  HOD
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  DEAN
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  CFO
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  FINANCE OFFICER
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Assignment Form
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const roleKey = normalizeRoleKey(user.university_role, {
                  is_hod: user.is_hod,
                  is_dean: user.is_dean,
                  is_cfo: user.is_cfo,
                  is_finance_officer: user.is_finance_officer,
                });
                const isHod = roleKey === "hod";
                const isDean = roleKey === "dean";
                const isCfo = roleKey === "cfo";
                const isFinance = roleKey === "finance_officer";
                const isEditing = editingUserId !== null && sameUserId(editingUserId, user.id);

                return (
                  <tr key={`${user.id}-${user.email}`} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-slate-900">{user.name || "Unnamed User"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-700">{user.email}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-700">{formatDate(user.created_at)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isHod ? "text-emerald-700" : "text-slate-400"}`}>
                        {isHod ? "Enabled" : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isDean ? "text-sky-700" : "text-slate-400"}`}>
                        {isDean ? "Enabled" : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isCfo ? "text-amber-700" : "text-slate-400"}`}>
                        {isCfo ? "Enabled" : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isFinance ? "text-violet-700" : "text-slate-400"}`}>
                        {isFinance ? "Enabled" : "-"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {isEditing && draft ? (
                        <div className="space-y-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Role Select</label>
                            <select
                              value={draft.role}
                              onChange={(event) => handleRoleChange(event.target.value as AssignableRole)}
                              disabled={isPending}
                              aria-label="Role Select"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Global Role Assignment
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Click Edit to assign role</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => saveAssignment(user.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={cancelEdit}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => beginEdit(user)}
                              className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => requestDelete(user)}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {pendingDeleteUserId !== null && sameUserId(pendingDeleteUserId, user.id)
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
>>>>>>> Stashed changes
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isUpdating = pendingUpdateUserId !== null && sameUserId(pendingUpdateUserId, user.id);
                    const isDeleting = pendingDeleteUserId !== null && sameUserId(pendingDeleteUserId, user.id);
                    const disabled = isPending || isUpdating || isDeleting;

                    return (
                      <tr key={`${user.id}-${user.email}`} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                          {user.name || "Unnamed User"}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{user.email}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_organiser}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "organiser")}
                            label="Toggle organiser"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_volunteer}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "volunteer")}
                            label="Toggle volunteer"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_venue_manager}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "venue_manager")}
                            label="Toggle venue manager"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_hod}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "hod")}
                            label="Toggle HOD"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_dean}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "dean")}
                            label="Toggle Dean"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_cfo}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "cfo")}
                            label="Toggle CFO"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_finance_officer}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "finance")}
                            label="Toggle finance"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <ToggleCell
                            checked={user.access.is_masteradmin}
                            disabled={disabled}
                            onChange={() => handleRoleToggle(user, "master_admin")}
                            label="Toggle master admin"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-700">
                          {resolveDomainSummary(user, initialData)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => requestDelete(user)}
                            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                        No users matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Global Revenue</p>
              <p className="mt-3 text-2xl font-black text-slate-900">
                {formatCurrency(initialData.analytics.totalEstimatedRevenue)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Estimated from fee-enabled events and participation counts.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Venue Utilization</p>
              <p className="mt-3 text-2xl font-black text-slate-900">
                {initialData.analytics.venueUtilizationRate.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Share of events that have an assigned venue.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Approval SLA</p>
              <p className="mt-3 text-2xl font-black text-slate-900">
                {initialData.analytics.averageApprovalSlaHours.toFixed(2)} hrs
              </p>
              <p className="mt-1 text-xs text-slate-500">Average submitted-to-decided duration across approvals.</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Revenue Trend</h3>
              <p className="mt-1 text-xs text-slate-500">Monthly estimated revenue across all events.</p>
              <div className="mt-4 h-72">
                {initialData.analytics.revenueByMonth.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No revenue data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={initialData.analytics.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(Number(value || 0))} />
                      <Area type="monotone" dataKey="revenue" stroke="#0f766e" fill="#99f6e4" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Venue Utilization Mix</h3>
              <p className="mt-1 text-xs text-slate-500">Top venues by event volume.</p>
              <div className="mt-4 h-72">
                {initialData.analytics.venueUsage.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No venue usage data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={initialData.analytics.venueUsage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="venue" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => Number(value || 0)} />
                      <Bar dataKey="events" fill="#0284c7" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Approval SLA by Month</h3>
            <p className="mt-1 text-xs text-slate-500">Average turnaround time by submission month.</p>
            <div className="mt-4 h-72">
              {initialData.analytics.approvalSlaByMonth.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No approval SLA data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={initialData.analytics.approvalSlaByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => `${Number(value || 0).toFixed(2)} hrs`} />
                    <Line type="monotone" dataKey="hours" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      <DomainScopeModal
        isOpen={domainModal.isOpen}
        mode={domainModal.role}
        userName={domainModal.userName}
        departments={initialData.departments}
        schools={initialData.schools}
        campuses={initialData.campuses}
        venues={initialData.venues}
        initialValue={domainModal.initialValue}
        onCancel={() => {
          setDomainModal(emptyModalState());
          setPendingModalRole(null);
        }}
        onConfirm={handleDomainConfirm}
      />
    </div>
  );
}
