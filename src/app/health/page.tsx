"use client";

/**
 * Health Dashboard Page (admin-only through `layout.tsx`, DEC-79).
 *
 * Renders the documented `/api/health` report (`docs/health.md`, REFAC-22):
 * overall status, the db / auth / storage probes, pg_cron freshness per job and
 * the last scraper-sourced insert. Types and parsing come from
 * `@/contracts/health`, so a body that is not the report (the liveness shape a
 * non-admin gets, or anything else) is shown as such instead of crashing the
 * page (research C18). Refreshes every 30 seconds.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  HelpCircle,
  Inbox,
  RefreshCcw,
  Shield,
  XCircle,
} from "lucide-react";
import {
  HealthLiveness,
  HealthReport,
  type HealthProbe,
} from "@/contracts/health";

const REFRESH_MS = 30_000;

type Tone = "good" | "warn" | "bad" | "neutral";

/** Every status the report can carry, mapped to one visual tone. */
const TONE: Record<string, Tone> = {
  ok: "good",
  degraded: "warn",
  stale: "warn",
  down: "bad",
  unknown: "neutral",
};

const TONE_CLASSES: Record<Tone, { badge: string; border: string; icon: string }> = {
  good: {
    badge: "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300",
    border: "border-green-200 dark:border-green-900",
    icon: "text-green-600",
  },
  warn: {
    badge: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-900",
    icon: "text-yellow-600",
  },
  bad: {
    badge: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300",
    border: "border-red-200 dark:border-red-900",
    icon: "text-red-600",
  },
  neutral: {
    badge: "bg-secondary text-muted-foreground hover:bg-secondary",
    border: "border-border",
    icon: "text-muted-foreground",
  },
};

function toneOf(status: string): Tone {
  return TONE[status] ?? "neutral";
}

function StatusIcon({ status, className = "h-5 w-5" }: { status: string; className?: string }) {
  const tone = toneOf(status);
  const cls = `${className} ${TONE_CLASSES[tone].icon}`;
  if (tone === "good") return <CheckCircle2 className={cls} />;
  if (tone === "warn") return <AlertTriangle className={cls} />;
  if (tone === "bad") return <XCircle className={cls} />;
  return <HelpCircle className={cls} />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={TONE_CLASSES[toneOf(status)].badge}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

type Loaded =
  | { kind: "report"; report: HealthReport }
  | { kind: "liveness"; version: string }
  | { kind: "unexpected"; httpStatus: number };

const PROBES: { key: "db" | "auth" | "storage"; title: string; icon: typeof Database }[] = [
  { key: "db", title: "Database", icon: Database },
  { key: "auth", title: "Auth", icon: Shield },
  { key: "storage", title: "Storage", icon: HardDrive },
];

function ProbeCard({ title, icon: Icon, probe }: { title: string; icon: typeof Database; probe: HealthProbe }) {
  const tone = TONE_CLASSES[toneOf(probe.status)];
  return (
    <Card className={tone.border} data-testid={`health-check-${title.toLowerCase()}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-secondary/50 p-2">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1 text-xs">{probe.latency_ms} ms</CardDescription>
            </div>
          </div>
          <StatusBadge status={probe.status} />
        </div>
      </CardHeader>
    </Card>
  );
}

export default function HealthPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealthData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // 503 still carries the report; only the body's shape decides.
      const response = await fetch("/api/health", { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      const report = HealthReport.safeParse(body);
      if (report.success) {
        setLoaded({ kind: "report", report: report.data });
      } else {
        const liveness = HealthLiveness.safeParse(body);
        setLoaded(
          liveness.success
            ? { kind: "liveness", version: liveness.data.version }
            : { kind: "unexpected", httpStatus: response.status }
        );
      }
      setLastChecked(new Date());
    } catch {
      setError("Failed to fetch health data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchHealthData]);

  const report = loaded?.kind === "report" ? loaded.report : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="relative w-full overflow-hidden bg-secondary/30 pb-16 pt-24 md:pb-20 md:pt-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Activity className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
                  System Health
                </h1>
              </div>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Database, auth, storage, scheduled jobs and scraper ingestion, refreshed every 30 seconds.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={fetchHealthData} disabled={loading} className="gap-2 rounded-xl">
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {lastChecked && (
                <p className="text-right text-sm text-muted-foreground">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container relative z-20 mx-auto -mt-8 px-4 py-12">
        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-6 w-6" />
                Error Loading Health Data
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : loading && !loaded ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : loaded?.kind === "liveness" ? (
          <Card data-testid="health-liveness-only">
            <CardHeader>
              <CardTitle>Service is up</CardTitle>
              <CardDescription>
                Version {loaded.version}. The diagnostic report needs an active admin session.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : loaded?.kind === "unexpected" ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Unexpected response</CardTitle>
              <CardDescription>
                /api/health answered HTTP {loaded.httpStatus} with a body that is not the documented report.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : report ? (
          <div className="space-y-8">
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <StatusIcon status={report.status} className="h-7 w-7" />
                    <div>
                      <CardTitle className="text-3xl">Overall Status</CardTitle>
                      <CardDescription className="mt-1">{formatTime(report.ts)}</CardDescription>
                    </div>
                  </div>
                  <span data-testid="health-overall-status" data-status={report.status}>
                    <StatusBadge status={report.status} />
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/30 p-4">
                    <Activity className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="text-2xl font-bold">{report.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/30 p-4">
                    <Inbox className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Last scraper-sourced insert</p>
                      <p className="text-lg font-bold" data-testid="health-webhook-last-ingest">
                        {formatTime(report.checks.webhook.last_ingest_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-6 text-2xl font-bold text-foreground">Dependencies</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {PROBES.map(({ key, title, icon }) => (
                  <ProbeCard key={key} title={title} icon={icon} probe={report.checks[key]} />
                ))}
              </div>
            </div>

            <Card className={TONE_CLASSES[toneOf(report.checks.pg_cron.status)].border}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5" />
                    <CardTitle className="text-lg">Scheduled jobs (pg_cron)</CardTitle>
                  </div>
                  <span data-testid="health-pg-cron-status">
                    <StatusBadge status={report.checks.pg_cron.status} />
                  </span>
                </div>
                {report.checks.pg_cron.status === "unknown" && report.checks.pg_cron.jobs.length === 0 && (
                  <CardDescription>
                    Job status is not readable in this environment (see docs/health.md).
                  </CardDescription>
                )}
              </CardHeader>
              {report.checks.pg_cron.jobs.length > 0 && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Job</th>
                          <th className="py-2 pr-4 font-medium">Schedule</th>
                          <th className="py-2 pr-4 font-medium">Active</th>
                          <th className="py-2 pr-4 font-medium">Last start</th>
                          <th className="py-2 pr-4 font-medium">Last status</th>
                          <th className="py-2 font-medium">Fresh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.checks.pg_cron.jobs.map((job) => (
                          <tr key={job.jobname} className="border-t border-border" data-testid="health-cron-job">
                            <td className="py-2 pr-4 font-mono">{job.jobname}</td>
                            <td className="py-2 pr-4 font-mono">{job.schedule}</td>
                            <td className="py-2 pr-4">{job.active ? "yes" : "no"}</td>
                            <td className="py-2 pr-4">{formatTime(job.last_start)}</td>
                            <td className="py-2 pr-4">{job.last_status ?? "none"}</td>
                            <td className="py-2">
                              {job.stale === null ? "unknown" : job.stale ? "stale" : "fresh"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
