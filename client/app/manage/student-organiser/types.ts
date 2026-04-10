export interface LogisticsRequestBlock {
  details: string;
  status: string;
  submittedAt: string | null;
}

export interface RunsheetItem {
  id: string;
  time: string;
  task: string;
  notes: string;
  order: number;
  assigneeRegistrationId: string | null;
  assigneeLabel: string | null;
}

export interface PostEventDetails {
  photoUrls: string[];
  reportUrls: string[];
  reportSummary: string;
  attendanceFinalized: boolean;
  attendanceFinalizedAt: string | null;
  attendanceFinalizedBy: string | null;
}

export interface StudentOrganiserEventItem {
  eventId: string;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  venue: string | null;
  festId: string;
  organizingDept: string | null;
  createdBy: string | null;
  organizerEmail: string | null;
  venueStatus: "pending" | "requested" | "confirmed";
  logistics: {
    it: LogisticsRequestBlock;
    venue: LogisticsRequestBlock;
    catering: LogisticsRequestBlock;
  };
  runsheetItems: RunsheetItem[];
  postEvent: PostEventDetails;
}

export interface VolunteerItem {
  eventId: string;
  registrationId: string;
  name: string;
  email: string | null;
  registeredAt: string | null;
}

export interface AttendanceSummary {
  eventId: string;
  total: number;
  attended: number;
  absent: number;
  pending: number;
}

export interface StudentOrganiserDashboardData {
  events: StudentOrganiserEventItem[];
  volunteersByEventId: Record<string, VolunteerItem[]>;
  attendanceByEventId: Record<string, AttendanceSummary>;
  warnings: string[];
}
