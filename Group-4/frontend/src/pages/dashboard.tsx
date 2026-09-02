import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { InterviewCard } from "@/components/interview/interview-card";
import { ErrorRetry } from "@/components/interview/error-retry";
import { ScoreTrendChart } from "@/components/interview/score-trend-chart";
import { PageHeader } from "@/components/page-header";
import { QuotaBadge } from "@/components/quota-badge";
import { useSession } from "@/lib/auth-client";
import { useTranslation } from "@/lib/i18n/language-provider";
import {
  ApiError,
  getInterview,
  listInterviews,
  type InterviewListItem,
  type Report,
} from "@/lib/interview-client";
import {
  computeScoreTrend,
  findTrendCandidates,
  type ScoreTrendPoint,
} from "@/lib/score-trend";
import { getActivePreAssessment } from "@/lib/pre-assessment-client";

// Auth-sonrasi inis sayfasi (getdevinterview.com referansi: karsilama + skor
// karti onizlemesi -> burada istatistik/trend/son gorusmeler). /interviews
// (Gorusmelerim) tam liste+silme yonetimine odaklanir; burasi genel bakis.
export default function DashboardPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { data } = useSession();
  const rawFirstName = data?.user?.name?.split(" ")[0];
  // Kullanicinin yazdigi ad aynen korunur, yalnizca ilk harf buyutulur.
  // Locale onemli: TR'de 'i' -> 'İ' (toUpperCase() 'I' verirdi).
  const firstName = rawFirstName
    ? rawFirstName[0].toLocaleUpperCase(i18n.language) + rawFirstName.slice(1)
    : rawFirstName;

  const [interviews, setInterviews] = useState<InterviewListItem[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [trendPoints, setTrendPoints] = useState<ScoreTrendPoint[] | null>(
    null,
  );
  // undefined = henuz bilinmiyor (CTA gizli), null = aktif kayit yok.
  const [hasActivePreAssessment, setHasActivePreAssessment] =
    useState<boolean>();

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await listInterviews();
      setInterviews(
        [...data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ön değerlendirme CTA'si: panelin YAN bilgisi — istegi basarisiz olursa
  // panel hata durumuna dusmez, yalnizca CTA gizli kalir (FR-030 kancasi).
  useEffect(() => {
    getActivePreAssessment()
      .then((active) => setHasActivePreAssessment(active !== null))
      .catch(() => setHasActivePreAssessment(undefined));
  }, []);

  useEffect(() => {
    if (!interviews) return;
    const candidates = findTrendCandidates(interviews);
    if (!candidates) {
      setTrendPoints(null);
      return;
    }
    let cancelled = false;
    Promise.all(candidates.map((c) => getInterview(c.id)))
      .then((details) => {
        if (cancelled) return;
        const withReports = candidates
          .map((c, i) => ({
            createdAt: c.createdAt,
            report: details[i].report,
          }))
          .filter(
            (item): item is { createdAt: string; report: Report } =>
              item.report !== null,
          );
        setTrendPoints(computeScoreTrend(withReports));
      })
      .catch(() => {
        if (!cancelled) setTrendPoints(null);
      });
    return () => {
      cancelled = true;
    };
  }, [interviews]);

  // Onay kapisi burada DEGIL, App.tsx'teki withShell'de mount edilir: panele
  // ugramadan /settings veya /interview/new acan kullanici da kapiyi gormeli.
  if (error) {
    return <ErrorRetry message={error} onRetry={load} />;
  }

  if (!interviews) {
    return (
      <p className="text-[var(--color-text-muted)]">{t("common:loading")}</p>
    );
  }

  const stats = {
    total: interviews.length,
    completed: interviews.filter((i) => i.status === "completed").length,
    inProgress: interviews.filter((i) => i.status === "in_progress").length,
    reportReady: interviews.filter((i) => i.reportStatus === "ready").length,
  };

  return (
    <>
      <PageHeader
        title={
          firstName ? t("greeting", { name: firstName }) : t("greetingFallback")
        }
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* 010-odeme-abonelik US4: kotayi ancak reddedildiginde ogrenmek
                kotu bir deneyim — gorusme baslatma dugmesinin yaninda durur. */}
            <QuotaBadge />
            <Link
              to="/interview/new"
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-strong)]"
            >
              {t("startInterview")}
            </Link>
          </div>
        }
      />

      {hasActivePreAssessment !== undefined && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            {hasActivePreAssessment
              ? t("preAssessment.readyMessage")
              : t("preAssessment.missingMessage")}
          </p>
          <Link
            to="/pre-assessment/new"
            className="shrink-0 rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
          >
            {hasActivePreAssessment
              ? t("preAssessment.viewReport")
              : t("preAssessment.fillIn")}
          </Link>
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <p className="font-display text-lg font-bold text-[var(--color-text)]">
            {t("empty.title")}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("empty.description")}
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t("stats.total"), stats.total],
              [t("stats.completed"), stats.completed],
              [t("stats.inProgress"), stats.inProgress],
              [t("stats.reportReady"), stats.reportReady],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <dt className="text-xs font-medium text-[var(--color-text-muted)]">
                  {label}
                </dt>
                <dd className="font-data mt-1 text-3xl font-semibold text-[var(--color-text)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {trendPoints && trendPoints.length >= 2 && (
            <div className="mt-6">
              <ScoreTrendChart points={trendPoints} />
            </div>
          )}

          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="font-display text-lg font-bold text-[var(--color-text)]">
                {t("recent.heading")}
              </h2>
              <Link
                to="/interviews"
                className="text-sm font-medium text-[var(--color-accent)]"
              >
                {t("recent.viewAll")}
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {interviews.slice(0, 3).map((interview) => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  onDeleted={(id) =>
                    setInterviews(
                      (prev) => prev?.filter((i) => i.id !== id) ?? null,
                    )
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
