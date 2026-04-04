"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Timer,
  Wrench,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
const MUTATION_CONFIRMATION_PHRASE = "I UNDERSTAND STATUSCHECK MUTATIONS";

type TableCount = {
  table: string;
  ok: boolean;
  count: number | null;
  error?: string;
};

type SummaryBucket = {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
};

type CheckItem = {
  name: string;
  ok: boolean;
  status?: number | string;
  method?: string;
  path?: string;
  durationMs?: number;
  message?: string;
  reason?: string;
  details?: Record<string, unknown>;
};

type LoadResult = {
  ok: boolean;
  target: string;
  targetPath: string;
  iterations: number;
  concurrency: number;
  completed: number;
  successCount: number;
  failureCount: number;
  errorRatePercent: number;
  totalDurationMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  failures?: Array<{
    index: number;
    status: string | number;
    durationMs: number;
    message?: string;
  }>;
};

type SummaryResponse = {
  ok: boolean;
  checkedAt: string;
  durationMs: number;
  requestedBy: string;
  apiBaseUrl: string;
  dbHealth: {
    ok: boolean;
    message: string;
  };
  sampleRows: {
    sampleEventId: string | null;
    sampleFestId: string | null;
    sampleUserEmail: string | null;
  };
  tableCounts: TableCount[];
  routeCoverage: Array<{
    group: string;
    mount: string;
    probe: string;
  }>;
  mutatingChecks: {
    enabled: boolean;
    confirmationRequired: string;
  };
};

type RunResponse = {
  ok: boolean;
  checkedAt: string;
  durationMs: number;
  includeMutations: boolean;
  requestedBy: string;
  endpointChecks: CheckItem[];
  fetchDisplayChecks: CheckItem[];
  workflowChecks: CheckItem[];
  mutationChecks: CheckItem[];
  loadCheck: LoadResult | null;
  summary: {
    endpoints: SummaryBucket;
    fetchDisplay: SummaryBucket;
    workflows: SummaryBucket;
    mutations: SummaryBucket;
  };
};

function cn(...values: Array<string | false | undefined | null>) {
  return values.filter(Boolean).join(" ");
}

function Badge({ ok, status }: { ok: boolean; status?: string | number }) {
  if (String(status) === "skipped") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Skipped
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      )}
    >
      {ok ? "Pass" : "Fail"}
      {typeof status === "number" ? ` (${status})` : ""}
    </span>
  );
}

function BucketCard({ label, data }: { label: string; data: SummaryBucket }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{data.passed}/{data.total}</div>
      <div className="mt-1 text-xs text-slate-500">
        failed: {data.failed} | skipped: {data.skipped}
      </div>
    </div>
  );
}

function CheckCard({ item }: { item: CheckItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{item.name}</div>
          {(item.method || item.path) && (
            <div className="mt-1 text-xs text-slate-500">
              {[item.method, item.path].filter(Boolean).join(" ")}
            </div>
          )}
        </div>
        <Badge ok={item.ok} status={item.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>duration: {item.durationMs ?? 0}ms</div>
        <div>status: {String(item.status ?? "n/a")}</div>
      </div>

      {(item.message || item.reason) && (
        <div className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
          {item.message || item.reason}
        </div>
      )}
    </div>
  );
}

export default function StatusCheckPage() {
  const router = useRouter();
  const { isLoading: authLoading, isMasterAdmin, session } = useAuth();

  const authToken = session?.access_token || null;

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [runningFull, setRunningFull] = useState(false);
  const [runningLoad, setRunningLoad] = useState(false);

  const [includeMutations, setIncludeMutations] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const [loadTarget, setLoadTarget] = useState("events");
  const [customPath, setCustomPath] = useState("");
  const [iterations, setIterations] = useState(30);
  const [concurrency, setConcurrency] = useState(4);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      router.replace("/auth");
      return;
    }

    if (!isMasterAdmin) {
      router.replace("/error");
    }
  }, [authLoading, session, isMasterAdmin, router]);

  const headers = useMemo(() => {
    if (!authToken) return null;
    return {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }, [authToken]);

  const fetchSummary = async () => {
    if (!headers) return;

    setLoadingSummary(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/summary`, {
        method: "GET",
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load status summary");
      }

      setSummary(data as SummaryResponse);
      toast.success("Status summary refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fetch summary");
    } finally {
      setLoadingSummary(false);
    }
  };

  const runFullCheck = async () => {
    if (!headers) return;

    if (includeMutations && confirmation.trim() !== MUTATION_CONFIRMATION_PHRASE) {
      toast.error("Mutation confirmation phrase does not match");
      return;
    }

    setRunningFull(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          includeMutations,
          confirmation,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to run full statuscheck");
      }

      setRunResult(data as RunResponse);
      if ((data as RunResponse).summary.endpoints.failed > 0) {
        toast.error("Statuscheck completed with failing probes");
      } else {
        toast.success("Full statuscheck completed successfully");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run statuscheck");
    } finally {
      setRunningFull(false);
    }
  };

  const runLoadCheck = async () => {
    if (!headers) return;

    setRunningLoad(true);
    try {
      const response = await fetch(`${API_URL}/api/statuscheck/load`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          target: loadTarget,
          customPath,
          iterations,
          concurrency,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to run load check");
      }

      setLoadResult((data?.result || null) as LoadResult | null);
      toast.success("Load check completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run load check");
    } finally {
      setRunningLoad(false);
    }
  };

  useEffect(() => {
    if (!isMasterAdmin || !headers) return;
    void fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMasterAdmin, headers]);

  if (authLoading || !authToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <RefreshCw className="mx-auto h-10 w-10 animate-spin text-[#154CB3]" />
          <p className="mt-3 text-slate-600">Loading statuscheck control hub...</p>
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#eef2ff_45%,_#f8fafc_100%)] py-8">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 p-6 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Masteradmin Only
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">StatusCheck Control Hub</h1>
            <p className="mt-1 text-sm text-slate-600">
              Endpoint health, workflow verification, fetch/display checks, mutation probes, and load diagnostics.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void fetchSummary()}
              disabled={loadingSummary}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", loadingSummary && "animate-spin")} />
              Refresh Summary
            </button>
            <button
              onClick={() => void runFullCheck()}
              disabled={runningFull}
              className="inline-flex items-center gap-2 rounded-lg bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#154CB3]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Activity className={cn("h-4 w-4", runningFull && "animate-pulse")} />
              Run Full Check
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Database className="h-4 w-4 text-[#154CB3]" />
              Database Health
            </div>
            <div className="mt-3 flex items-center gap-2">
              {summary?.dbHealth.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              )}
              <span className="text-sm text-slate-700">{summary?.dbHealth.message || "No summary loaded"}</span>
            </div>
            <div className="mt-3 text-xs text-slate-500">checked by: {summary?.requestedBy || "-"}</div>
            <div className="mt-1 text-xs text-slate-500">at: {summary?.checkedAt || "-"}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Wrench className="h-4 w-4 text-[#154CB3]" />
              Mutation Guard
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Mutating tests are disabled by default. Enable only when you intend to insert and delete synthetic rows.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includeMutations}
                onChange={(event) => setIncludeMutations(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Enable insert/delete mutation probes
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={MUTATION_CONFIRMATION_PHRASE}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#154CB3] focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Timer className="h-4 w-4 text-[#154CB3]" />
              Last Runtime
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">
              {runResult ? `${runResult.durationMs}ms` : "-"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {runResult ? `completed at ${runResult.checkedAt}` : "Run full check to generate runtime metrics"}
            </div>
          </div>
        </div>

        {summary && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Table Snapshot</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {summary.tableCounts.map((table) => (
                <div
                  key={table.table}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    table.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                  )}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{table.table}</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">
                    {table.count === null ? "n/a" : table.count}
                  </div>
                  {!table.ok && table.error && <div className="text-xs text-rose-700">{table.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Load Target
                <select
                  value={loadTarget}
                  onChange={(event) => setLoadTarget(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <option value="events">events</option>
                  <option value="fests">fests</option>
                  <option value="users">users</option>
                  <option value="notifications">notifications</option>
                  <option value="registrations">registrations</option>
                  <option value="participants">participants</option>
                  <option value="chat">chat</option>
                  <option value="custom">custom path</option>
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Iterations
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={iterations}
                  onChange={(event) => setIterations(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Concurrency
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={concurrency}
                  onChange={(event) => setConcurrency(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Custom Path
                <input
                  type="text"
                  value={customPath}
                  onChange={(event) => setCustomPath(event.target.value)}
                  placeholder="/api/events?page=1&pageSize=5"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                />
              </label>
            </div>

            <button
              onClick={() => void runLoadCheck()}
              disabled={runningLoad}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Gauge className={cn("h-4 w-4", runningLoad && "animate-pulse")} />
              Run Load Check
            </button>
          </div>

          {loadResult && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">error rate</div>
                <div className="text-xl font-bold text-slate-800">{loadResult.errorRatePercent}%</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">p50</div>
                <div className="text-xl font-bold text-slate-800">{loadResult.p50Ms}ms</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">p95</div>
                <div className="text-xl font-bold text-slate-800">{loadResult.p95Ms}ms</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">throughput</div>
                <div className="text-xl font-bold text-slate-800">{loadResult.successCount}/{loadResult.completed}</div>
              </div>
            </div>
          )}
        </div>

        {runResult && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BucketCard label="Endpoint Checks" data={runResult.summary.endpoints} />
              <BucketCard label="Fetch/Display" data={runResult.summary.fetchDisplay} />
              <BucketCard label="Workflow Checks" data={runResult.summary.workflows} />
              <BucketCard label="Mutation Checks" data={runResult.summary.mutations} />
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800">Endpoint Checks</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {runResult.endpointChecks.map((item) => (
                  <CheckCard key={`endpoint-${item.name}`} item={item} />
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800">Fetch/Display Checks</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {runResult.fetchDisplayChecks.map((item) => (
                  <CheckCard key={`fetch-${item.name}`} item={item} />
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800">Workflow Checks</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {runResult.workflowChecks.map((item) => (
                  <CheckCard key={`workflow-${item.name}`} item={item} />
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800">Mutation Checks</h2>
              {!includeMutations && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Mutating checks are currently disabled. Enable and confirm the phrase to test insert/delete workflows.
                </div>
              )}
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {runResult.mutationChecks.map((item) => (
                  <CheckCard key={`mutation-${item.name}`} item={item} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
