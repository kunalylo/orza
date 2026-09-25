"use client";
import * as React from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { dateInTz } from "@/lib/dates";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { DailyReportView } from "@/components/reports/DailyReportView";
import { WeeklyReportView } from "@/components/reports/WeeklyReportView";
import { DoctorReport } from "@/components/reports/DoctorReport";
import { downloadText, weeklyCsv, type DailyReport, type WeeklyReport } from "@/components/reports/format";

type Tab = "daily" | "weekly";

/** One report endpoint (`/api/<path>?<param>=<key>`): latest request wins, with loading + error state. */
function useReport<T>(path: string, param: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const seq = React.useRef(0);

  const load = React.useCallback(
    async (key: string): Promise<T | null> => {
      const id = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<T>(`${path}?${param}=${encodeURIComponent(key)}`);
        if (id === seq.current) setData(res);
        return res;
      } catch (e) {
        if (id === seq.current) setError(errorMessage(e));
        return null;
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [path, param]
  );

  return { data, loading, error, load };
}

/** Reports: Daily | Weekly, plus a print-friendly export for your doctor and a CSV download. */
export default function ReportsPage() {
  const { user } = useUser();
  const tz = user.profile?.timezone;
  const today = React.useMemo(() => dateInTz(tz), [tz]);
  const [tab, setTab] = React.useState<Tab>("daily");
  const [date, setDate] = React.useState(today);
  const [end, setEnd] = React.useState(today);
  const [exporting, setExporting] = React.useState<"print" | "csv" | null>(null);
  const [printNow, setPrintNow] = React.useState(false);

  const daily = useReport<DailyReport>("/reports/daily", "date");
  const weekly = useReport<WeeklyReport>("/reports/weekly", "end");
  const loadDaily = daily.load;
  const loadWeekly = weekly.load;

  React.useEffect(() => {
    loadDaily(date);
  }, [date, loadDaily]);

  // Weekly loads lazily — the first time the tab is opened, then whenever the week changes.
  const weeklyWanted = tab === "weekly" || weekly.data != null;
  React.useEffect(() => {
    if (weeklyWanted) loadWeekly(end);
  }, [end, weeklyWanted, loadWeekly]);

  /** The weekly report for the selected week, fetching it if needed. */
  const currentWeek = async (): Promise<WeeklyReport | null> => {
    if (weekly.data && weekly.data.end === end && !weekly.loading) return weekly.data;
    const res = await loadWeekly(end);
    if (!res) toast.error("Couldn't load your weekly report. Please try again.");
    return res;
  };

  const exportForDoctor = async () => {
    setExporting("print");
    const w = await currentWeek();
    if (!w) {
      setExporting(null);
      return;
    }
    setPrintNow(true);
  };

  // Print after React has rendered the latest data into the print panel.
  React.useEffect(() => {
    if (!printNow) return;
    const raf = requestAnimationFrame(() => {
      window.print();
      setPrintNow(false);
      setExporting(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [printNow]);

  const downloadCsv = async () => {
    setExporting("csv");
    try {
      const w = await currentWeek();
      if (!w) return;
      downloadText(`orza-weekly-${w.start}-to-${w.end}.csv`, weeklyCsv(w));
      toast.success("Weekly CSV downloaded");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Your wellness, in numbers"
        description="Track your wellness journey over time — a gentle daily check-in and a weekly view you can share with your doctor."
        actions={
          <>
            <Button variant="secondary" onClick={downloadCsv} loading={exporting === "csv"} disabled={!!exporting}>
              {exporting !== "csv" && <Download size={15} strokeWidth={1.9} aria-hidden />} Download CSV
            </Button>
            <Button variant="primary" onClick={exportForDoctor} loading={exporting === "print"} disabled={!!exporting}>
              {exporting !== "print" && <Printer size={15} strokeWidth={1.9} aria-hidden />} Export for your doctor
            </Button>
          </>
        }
      />

      <Segmented<Tab> semantics="tabs" id="report-tabs" panelId="report-panel" aria-label="Report period"
        value={tab}
        onChange={setTab}
        options={[
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
        ]}
        className="mb-6"
      />

      <div role="tabpanel" id="report-panel" aria-labelledby={`report-tabs-${tab}`}>
        {tab === "daily" ? (
          <DailyReportView
            report={daily.data}
            loading={daily.loading || (!daily.data && !daily.error)}
            error={daily.error}
            onRetry={() => loadDaily(date)}
            date={date}
            today={today}
            onDateChange={setDate}
          />
        ) : (
          <WeeklyReportView
            report={weekly.data}
            loading={weekly.loading || (!weekly.data && !weekly.error)}
            error={weekly.error}
            onRetry={() => loadWeekly(end)}
            end={end}
            today={today}
            onEndChange={setEnd}
          />
        )}
      </div>

      <DoctorReport
        user={user}
        weekly={weekly.data && weekly.data.end === end ? weekly.data : null}
        daily={daily.data && daily.data.date === date ? daily.data : null}
        generatedOn={today}
      />
    </div>
  );
}
