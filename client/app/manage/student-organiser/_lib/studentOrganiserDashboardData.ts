import "server-only";

import {
  AttendanceSummary,
  PostEventDetails,
  RunsheetItem,
  StudentOrganiserDashboardData,
  StudentOrganiserEventItem,
  VolunteerItem,
} from "../types";

type GenericRow = Record<string, unknown>;

type AttendanceRow = {
  event_id?: string | null;
  status?: string | null;
};

type RegistrationRow = {
  event_id?: string | null;
  registration_id?: string | null;
  individual_name?: string | null;
  individual_email?: string | null;
  team_leader_name?: string | null;
  team_leader_email?: string | null;
  created_at?: string | null;
};

const EVENT_SELECT_CANDIDATES = [
  "event_id,title,event_date,event_time,venue,organizing_dept,created_by,organizer_email,fest_id,schedule,additional_requests,event_heads",
  "event_id,title,event_date,event_time,venue,organizing_dept,created_by,organizer_email,fest_id,schedule,additional_requests",
] as const;

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0);
  }

  const singleValue = normalizeText(value);
  if (!singleValue) {
    return [];
  }

  return singleValue
    .split(/[\n,]/)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 0);
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function parseEventHeads(value: unknown): string[] {
  const rawHeads = Array.isArray(value) ? value : [];
  const resolvedEmails = rawHeads
    .map((entry) => {
      if (typeof entry === "string") {
        return normalizeLower(entry);
      }

      if (entry && typeof entry === "object") {
        return normalizeLower((entry as Record<string, unknown>).email);
      }

      return "";
    })
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(resolvedEmails));
}

function isSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = normalizeText(error?.code).toUpperCase();
  const message = normalizeLower(error?.message);

  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function deriveVolunteerName(row: RegistrationRow): string {
  const individualName = normalizeText(row.individual_name);
  if (individualName) {
    return individualName;
  }

  const leaderName = normalizeText(row.team_leader_name);
  if (leaderName) {
    return leaderName;
  }

  return "Volunteer";
}

function deriveVolunteerEmail(row: RegistrationRow): string | null {
  const individualEmail = normalizeText(row.individual_email);
  if (individualEmail) {
    return individualEmail;
  }

  const leaderEmail = normalizeText(row.team_leader_email);
  return leaderEmail || null;
}

function deriveLogisticsRequestBlock(
  logisticsRequests: Record<string, unknown>,
  additionalRequests: Record<string, unknown>,
  key: "it" | "venue" | "catering"
) {
  const opsRecord = asRecord(logisticsRequests[key]);
  const moduleRecord = asRecord(additionalRequests[key]);

  const details =
    normalizeText(opsRecord.details) ||
    normalizeText(moduleRecord.description) ||
    normalizeText(moduleRecord.customVenue) ||
    normalizeText(moduleRecord.selectedVenue);

  const submittedAt =
    normalizeText(opsRecord.submitted_at) || normalizeText(moduleRecord.submitted_at) || null;

  const status =
    normalizeText(opsRecord.status) ||
    (details.length > 0 ? "submitted" : "pending");

  return {
    details,
    status,
    submittedAt,
  };
}

function deriveVenueStatus(
  eventVenue: unknown,
  venueRequest: { details: string; status: string }
): "pending" | "requested" | "confirmed" {
  const normalizedStatus = normalizeLower(venueRequest.status);

  if (["confirmed", "approved", "completed", "done"].includes(normalizedStatus)) {
    return "confirmed";
  }

  if (venueRequest.details.length > 0) {
    return "requested";
  }

  if (normalizeText(eventVenue).length > 0) {
    return "confirmed";
  }

  return "pending";
}

function toRunsheetItems(eventId: string, source: unknown): RunsheetItem[] {
  const rawItems = Array.isArray(source) ? source : [];

  return rawItems
    .map((item, index) => {
      const record = asRecord(item);
      const task = normalizeText(record.task) || normalizeText(record.activity);
      if (!task) {
        return null;
      }

      return {
        id:
          normalizeText(record.id) ||
          `${eventId}-runsheet-${index + 1}`,
        time: normalizeText(record.time),
        task,
        notes: normalizeText(record.notes),
        order: toNumber(record.order) || index,
        assigneeRegistrationId:
          normalizeText(record.assignee_registration_id || record.assigneeRegistrationId) || null,
        assigneeLabel: normalizeText(record.assignee_label || record.assigneeLabel) || null,
      } satisfies RunsheetItem;
    })
    .filter((item): item is RunsheetItem => Boolean(item))
    .sort((left, right) => left.order - right.order);
}

function derivePostEventDetails(opsRecord: Record<string, unknown>): PostEventDetails {
  const postEventRecord = asRecord(opsRecord.post_event);

  return {
    photoUrls: asStringArray(postEventRecord.photo_urls),
    reportUrls: asStringArray(postEventRecord.report_urls),
    reportSummary: normalizeText(postEventRecord.report_summary),
    attendanceFinalized: Boolean(postEventRecord.attendance_finalized),
    attendanceFinalizedAt: normalizeText(postEventRecord.attendance_finalized_at) || null,
    attendanceFinalizedBy: normalizeText(postEventRecord.attendance_finalized_by) || null,
  };
}

async function queryEventsWithFallback(
  supabase: any,
  buildQuery: (query: any) => any,
  purpose: string,
  warnings: string[]
): Promise<GenericRow[]> {
  for (const selectClause of EVENT_SELECT_CANDIDATES) {
    const { data, error } = await buildQuery(
      supabase
        .from("events")
        .select(selectClause)
        .not("fest_id", "is", null)
    );

    if (!error) {
      return Array.isArray(data) ? (data as GenericRow[]) : [];
    }

    if (!isSchemaError(error)) {
      throw new Error(`Failed to load ${purpose}: ${error.message}`);
    }
  }

  warnings.push(`Could not resolve all required event columns for ${purpose}.`);
  return [];
}

async function queryHeadAssignedEvents(
  supabase: any,
  userEmail: string,
  warnings: string[]
): Promise<GenericRow[]> {
  const selectClause = EVENT_SELECT_CANDIDATES[0];

  const attempts = [
    () =>
      supabase
        .from("events")
        .select(selectClause)
        .contains("event_heads", [userEmail])
        .not("fest_id", "is", null),
    () =>
      supabase
        .from("events")
        .select(selectClause)
        .contains("event_heads", [{ email: userEmail }])
        .not("fest_id", "is", null),
  ];

  const rows: GenericRow[] = [];

  for (const attempt of attempts) {
    const { data, error } = await attempt();

    if (error) {
      if (isSchemaError(error)) {
        warnings.push("event_heads filter is unavailable in this schema; only ownership filters were applied.");
        return [];
      }

      warnings.push(`Could not load event-head assignments: ${error.message}`);
      continue;
    }

    if (Array.isArray(data)) {
      rows.push(...(data as GenericRow[]));
    }
  }

  return rows;
}

function mergeUniqueEvents(rows: GenericRow[]): GenericRow[] {
  const byEventId = new Map<string, GenericRow>();

  rows.forEach((row) => {
    const eventId = normalizeText(row.event_id);
    if (!eventId) {
      return;
    }

    if (!byEventId.has(eventId)) {
      byEventId.set(eventId, row);
    }
  });

  return Array.from(byEventId.values());
}

function mapEventRowToDashboardItem(row: GenericRow): StudentOrganiserEventItem {
  const eventId = normalizeText(row.event_id);
  const additionalRequests = parseJsonRecord(row.additional_requests);
  const studentOps = asRecord(additionalRequests.student_organiser_ops);
  const logisticsRequests = asRecord(studentOps.logistics_requests);

  const runsheetSource =
    Array.isArray(studentOps.runsheet_items) && studentOps.runsheet_items.length > 0
      ? studentOps.runsheet_items
      : Array.isArray(row.schedule)
        ? row.schedule
        : [];

  const itRequest = deriveLogisticsRequestBlock(logisticsRequests, additionalRequests, "it");
  const venueRequest = deriveLogisticsRequestBlock(logisticsRequests, additionalRequests, "venue");
  const cateringRequest = deriveLogisticsRequestBlock(logisticsRequests, additionalRequests, "catering");

  return {
    eventId,
    title: normalizeText(row.title) || "Untitled Event",
    eventDate: normalizeText(row.event_date) || null,
    eventTime: normalizeText(row.event_time) || null,
    venue: normalizeText(row.venue) || null,
    festId: normalizeText(row.fest_id),
    organizingDept: normalizeText(row.organizing_dept) || null,
    createdBy: normalizeText(row.created_by) || null,
    organizerEmail: normalizeText(row.organizer_email) || null,
    venueStatus: deriveVenueStatus(row.venue, venueRequest),
    logistics: {
      it: itRequest,
      venue: venueRequest,
      catering: cateringRequest,
    },
    runsheetItems: toRunsheetItems(eventId, runsheetSource),
    postEvent: derivePostEventDetails(studentOps),
  };
}

function sortEventsByDate(events: StudentOrganiserEventItem[]): StudentOrganiserEventItem[] {
  return [...events].sort((left, right) => {
    const leftTimestamp = new Date(left.eventDate || 0).getTime();
    const rightTimestamp = new Date(right.eventDate || 0).getTime();

    if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp)) {
      return leftTimestamp - rightTimestamp;
    }

    return left.title.localeCompare(right.title);
  });
}

export async function fetchStudentOrganiserDashboardData({
  supabase,
  userEmail,
}: {
  supabase: any;
  userEmail: string;
}): Promise<StudentOrganiserDashboardData> {
  const normalizedUserEmail = normalizeLower(userEmail);
  const warnings: string[] = [];

  if (!normalizedUserEmail) {
    return {
      events: [],
      volunteersByEventId: {},
      attendanceByEventId: {},
      warnings: ["Missing signed-in email context for Student Organiser dashboard."],
    };
  }

  const [createdByRows, organizerRows] = await Promise.all([
    queryEventsWithFallback(
      supabase,
      (query) => query.eq("created_by", normalizedUserEmail),
      "created-by sub-events",
      warnings
    ),
    queryEventsWithFallback(
      supabase,
      (query) => query.eq("organizer_email", normalizedUserEmail),
      "organizer-email sub-events",
      warnings
    ),
  ]);

  const headAssignedRows = await queryHeadAssignedEvents(supabase, normalizedUserEmail, warnings);

  const mergedRows = mergeUniqueEvents([...createdByRows, ...organizerRows, ...headAssignedRows]);

  const scopedRows = mergedRows.filter((row) => {
    const festId = normalizeText(row.fest_id);
    if (!festId) {
      return false;
    }

    const createdBy = normalizeLower(row.created_by);
    const isOwner = createdBy === normalizedUserEmail;
    const isHead = parseEventHeads(row.event_heads).includes(normalizedUserEmail);

    return isOwner || isHead;
  });

  const events = sortEventsByDate(scopedRows.map(mapEventRowToDashboardItem));
  const eventIds = events.map((event) => event.eventId);

  if (eventIds.length === 0) {
    return {
      events,
      volunteersByEventId: {},
      attendanceByEventId: {},
      warnings,
    };
  }

  const volunteersByEventId: Record<string, VolunteerItem[]> = {};
  const registrationCountByEventId: Record<string, number> = {};

  const { data: registrationData, error: registrationError } = await supabase
    .from("registrations")
    .select(
      "event_id,registration_id,individual_name,individual_email,team_leader_name,team_leader_email,created_at"
    )
    .in("event_id", eventIds);

  if (registrationError) {
    warnings.push(`Could not load volunteer rows: ${registrationError.message}`);
  } else if (Array.isArray(registrationData)) {
    const rows = registrationData as RegistrationRow[];

    rows.forEach((row) => {
      const eventId = normalizeText(row.event_id);
      const registrationId = normalizeText(row.registration_id);
      if (!eventId || !registrationId) {
        return;
      }

      if (!volunteersByEventId[eventId]) {
        volunteersByEventId[eventId] = [];
      }

      const alreadyExists = volunteersByEventId[eventId].some(
        (volunteer) => volunteer.registrationId === registrationId
      );

      if (alreadyExists) {
        return;
      }

      volunteersByEventId[eventId].push({
        eventId,
        registrationId,
        name: deriveVolunteerName(row),
        email: deriveVolunteerEmail(row),
        registeredAt: normalizeText(row.created_at) || null,
      });
    });

    Object.keys(volunteersByEventId).forEach((eventId) => {
      volunteersByEventId[eventId] = volunteersByEventId[eventId].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
      registrationCountByEventId[eventId] = volunteersByEventId[eventId].length;
    });
  }

  const attendanceByEventId: Record<string, AttendanceSummary> = {};

  const { data: attendanceData, error: attendanceError } = await supabase
    .from("attendance_status")
    .select("event_id,status")
    .in("event_id", eventIds);

  if (attendanceError) {
    warnings.push(`Could not load attendance summary rows: ${attendanceError.message}`);
  }

  eventIds.forEach((eventId) => {
    const summary: AttendanceSummary = {
      eventId,
      total: registrationCountByEventId[eventId] || 0,
      attended: 0,
      absent: 0,
      pending: 0,
    };

    attendanceByEventId[eventId] = summary;
  });

  if (Array.isArray(attendanceData)) {
    const rows = attendanceData as AttendanceRow[];

    rows.forEach((row) => {
      const eventId = normalizeText(row.event_id);
      const status = normalizeLower(row.status);

      if (!eventId || !attendanceByEventId[eventId]) {
        return;
      }

      if (status === "attended") {
        attendanceByEventId[eventId].attended += 1;
      } else if (status === "absent") {
        attendanceByEventId[eventId].absent += 1;
      } else {
        attendanceByEventId[eventId].pending += 1;
      }
    });
  }

  Object.values(attendanceByEventId).forEach((summary) => {
    const inferredPending = Math.max(summary.total - summary.attended - summary.absent, 0);
    summary.pending = Math.max(summary.pending, inferredPending);
  });

  return {
    events,
    volunteersByEventId,
    attendanceByEventId,
    warnings,
  };
}
