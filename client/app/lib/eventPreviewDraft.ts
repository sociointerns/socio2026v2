import { EventFormData } from "@/app/lib/eventFormSchema";
import { formatDateUTC, formatTime, getDaysUntil } from "@/lib/dateUtils";

const EVENT_PREVIEW_STORAGE_PREFIX = "__event_preview_draft__:";
const EVENT_PREVIEW_TTL_MS = 12 * 60 * 60 * 1000;

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const getFileFromInput = (
  fileInput: FileList | File | null | undefined
): File | null => {
  if (!fileInput) return null;
  if (fileInput instanceof File) return fileInput;
  if (fileInput instanceof FileList && fileInput.length > 0) return fileInput[0];
  return null;
};

const toCleanString = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const getFallbackEventImage = (): string =>
  process.env.NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL ||
  process.env.NEXT_PUBLIC_EVENT_IMAGE_PLACEHOLDER_URL ||
  "";

const parseTeamParticipants = (
  rawValue: string | undefined,
  fallbackValue: number
): number => {
  const parsed = Number(rawValue);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.floor(parsed));
  }
  return fallbackValue;
};

const normalizeTextList = (
  value: Array<{ value: string }> | undefined
): string[] | undefined => {
  const normalized = (value || [])
    .map((item) => toCleanString(item?.value))
    .filter((item) => item.length > 0);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeSchedule = (
  value: Array<{ time: string; activity: string }> | undefined
): Array<{ time: string; activity: string }> | undefined => {
  const normalized = (value || [])
    .map((item) => ({
      time: toCleanString(item?.time),
      activity: toCleanString(item?.activity),
    }))
    .filter((item) => item.time.length > 0 && item.activity.length > 0);

  return normalized.length > 0 ? normalized : undefined;
};

const buildPriceLabel = (registrationFee: string | undefined): string => {
  const normalizedFee = toCleanString(registrationFee);
  if (!normalizedFee) return "Free";

  const parsedFee = Number(normalizedFee);
  if (!Number.isFinite(parsedFee) || parsedFee <= 0) return "Free";

  return `\u20b9${normalizedFee}`;
};

const makeDraftStorageKey = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getStorageItemKey = (draftKey: string): string =>
  `${EVENT_PREVIEW_STORAGE_PREFIX}${draftKey}`;

interface StoredEventPreviewDraft {
  version: 1;
  createdAt: number;
  data: EventPreviewData;
}

export interface EventPreviewData {
  id: string;
  sourcePath?: string;
  title: string;
  department: string;
  tags?: string[];
  date: string;
  time: string;
  endDate: string;
  location: string;
  price: string;
  minTeammates: number;
  numTeammates: number;
  daysLeft: number | null;
  description: string;
  rules?: string[];
  schedule?: Array<{ time: string; activity: string }>;
  prizes?: string[];
  image: string;
  pdf?: string;
  organizers?: Array<{ name: string; email: string; phone: string }>;
  whatsappLink?: string;
  registrationDeadlineISO?: string | null;
  on_spot?: boolean;
  allow_outsiders?: boolean;
  custom_fields?: unknown[];
}

export interface BuildEventPreviewOptions {
  formData: EventFormData;
  sourcePath?: string;
  existingImageFileUrl?: string | null;
  existingBannerFileUrl?: string | null;
  existingPdfFileUrl?: string | null;
}

export const cleanupExpiredEventPreviewDrafts = (): void => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(EVENT_PREVIEW_STORAGE_PREFIX)) {
      continue;
    }

    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        window.localStorage.removeItem(key);
        continue;
      }

      const parsed = JSON.parse(rawValue) as Partial<StoredEventPreviewDraft>;
      if (
        typeof parsed.createdAt !== "number" ||
        now - parsed.createdAt > EVENT_PREVIEW_TTL_MS
      ) {
        window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }
};

export const buildEventPreviewData = (
  options: BuildEventPreviewOptions
): EventPreviewData => {
  const {
    formData,
    sourcePath,
    existingImageFileUrl,
    existingBannerFileUrl,
    existingPdfFileUrl,
  } = options;

  const selectedImageFile = getFileFromInput(formData.imageFile);
  const selectedBannerFile = getFileFromInput(formData.bannerFile);
  const selectedPdfFile = getFileFromInput(formData.pdfFile);

  const selectedImageUrl = selectedImageFile
    ? URL.createObjectURL(selectedImageFile)
    : null;
  const selectedBannerUrl = selectedBannerFile
    ? URL.createObjectURL(selectedBannerFile)
    : null;
  const selectedPdfUrl = selectedPdfFile ? URL.createObjectURL(selectedPdfFile) : null;

  const isTeamEvent = Boolean(formData.isTeamEvent);
  const maxParticipants = isTeamEvent
    ? parseTeamParticipants(formData.maxParticipants, 2)
    : 1;
  const minParticipants = isTeamEvent
    ? Math.min(
        parseTeamParticipants(formData.minParticipants, 2),
        maxParticipants
      )
    : 1;

  const festTag = toCleanString(formData.festEvent);
  const categoryTag = toCleanString(formData.category);
  const tags = [
    ...(festTag && festTag !== "none" ? [festTag] : []),
    ...(categoryTag ? [categoryTag] : []),
  ];

  const imageCandidates = [
    selectedBannerUrl,
    toCleanString(existingBannerFileUrl || "") || null,
    selectedImageUrl,
    toCleanString(existingImageFileUrl || "") || null,
    getFallbackEventImage() || null,
  ];
  const selectedImage =
    imageCandidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0
    ) || "";

  const contactEmail = toCleanString(formData.contactEmail);
  const contactPhone = toCleanString(formData.contactPhone);

  const previewId =
    toSlug(toCleanString(formData.eventTitle)) || `preview-${Date.now()}`;

  return {
    id: previewId,
    sourcePath,
    title: toCleanString(formData.eventTitle) || "Untitled Event",
    department: toCleanString(formData.organizingDept) || "General",
    tags: tags.length > 0 ? tags : undefined,
    date: formatDateUTC(formData.eventDate, "Date TBD"),
    time: formatTime(formData.eventTime, "Time TBD"),
    endDate: formatDateUTC(formData.endDate || formData.eventDate, "Date TBD"),
    location: toCleanString(formData.location) || "Location TBD",
    price: buildPriceLabel(formData.registrationFee),
    minTeammates: minParticipants,
    numTeammates: maxParticipants,
    daysLeft: getDaysUntil(formData.registrationDeadline),
    description:
      toCleanString(formData.detailedDescription) || "No description available.",
    rules: normalizeTextList(formData.rules),
    schedule: normalizeSchedule(formData.scheduleItems),
    prizes: normalizeTextList(formData.prizes),
    image: selectedImage,
    pdf:
      selectedPdfUrl ||
      toCleanString(existingPdfFileUrl || "") ||
      undefined,
    organizers:
      contactEmail || contactPhone
        ? [
            {
              name: "Event Coordination Team",
              email: contactEmail || "N/A",
              phone: contactPhone || "N/A",
            },
          ]
        : undefined,
    whatsappLink: toCleanString(formData.whatsappLink) || undefined,
    registrationDeadlineISO: toCleanString(formData.registrationDeadline) || null,
    on_spot: Boolean(formData.onSpot),
    allow_outsiders: Boolean(formData.allowOutsiders),
    custom_fields: Array.isArray(formData.customFields)
      ? formData.customFields
      : undefined,
  };
};

export const saveEventPreviewDraft = (draftData: EventPreviewData): string => {
  if (typeof window === "undefined") {
    throw new Error("Preview drafts can only be saved in the browser.");
  }

  cleanupExpiredEventPreviewDrafts();

  const draftKey = makeDraftStorageKey();
  const storedDraft: StoredEventPreviewDraft = {
    version: 1,
    createdAt: Date.now(),
    data: draftData,
  };

  window.localStorage.setItem(
    getStorageItemKey(draftKey),
    JSON.stringify(storedDraft)
  );

  return draftKey;
};

export const getEventPreviewDraft = (draftKey: string): EventPreviewData | null => {
  if (typeof window === "undefined") return null;
  if (!draftKey) return null;

  cleanupExpiredEventPreviewDrafts();

  const storageValue = window.localStorage.getItem(getStorageItemKey(draftKey));
  if (!storageValue) return null;

  try {
    const parsed = JSON.parse(storageValue) as Partial<StoredEventPreviewDraft>;
    if (!parsed || typeof parsed.createdAt !== "number" || !parsed.data) {
      return null;
    }

    if (Date.now() - parsed.createdAt > EVENT_PREVIEW_TTL_MS) {
      window.localStorage.removeItem(getStorageItemKey(draftKey));
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};
