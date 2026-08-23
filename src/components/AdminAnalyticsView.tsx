import React, { useState } from "react";
import {
  Users,
  Eye,
  Calendar,
  Clock,
  TrendingUp,
  BarChart3,
  Sparkles,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import type { AnalyticsSummary, ActivityBucket } from "@/lib/analytics-server";

interface AdminAnalyticsViewProps {
  analytics: AnalyticsSummary | null;
  isLoading: boolean;
}

export function AdminAnalyticsView({ analytics, isLoading }: AdminAnalyticsViewProps) {
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const [hoveredBucket, setHoveredBucket] = useState<ActivityBucket | null>(null);

  if (isLoading && !analytics) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs">Loading analytics data...</span>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground border border-dashed rounded-2xl border-border bg-card/40">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs">{t("analyticsNoData")}</p>
      </div>
    );
  }

  // Determine active buckets based on selected range
  const activeBuckets: ActivityBucket[] =
    timeRange === "daily"
      ? analytics.dailyVisitors
      : timeRange === "weekly"
        ? analytics.weeklyVisitors
        : analytics.monthlyVisitors;

  const maxVal = Math.max(1, ...activeBuckets.map((b) => Math.max(b.visits, b.uniqueUsers)));

  // Format last activity timestamp
  const formatLastActivity = (iso: string | null) => {
    if (!iso) return "No activity yet";
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;

      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* 5 Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Users */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("analyticsTotalUsers")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold text-foreground font-mono">
              {analytics.totalUsers.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
              {t("analyticsUniqueUsersDesc")}
            </p>
          </div>
        </div>

        {/* Total Visits */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("analyticsTotalVisits")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Eye className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold text-foreground font-mono">
              {analytics.totalVisits.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
              {t("analyticsTotalVisitsDesc")}
            </p>
          </div>
        </div>

        {/* Today's Users */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("analyticsTodayUsers")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {analytics.todayUsers.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {analytics.todayUsers > 0 ? "Active today" : "No visitors yet"}
            </p>
          </div>
        </div>

        {/* Today's Visits */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("analyticsTodayVisits")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono">
              {analytics.todayVisits.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Sessions recorded today</p>
          </div>
        </div>

        {/* Last Activity */}
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs col-span-2 sm:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("analyticsLastActivity")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-foreground font-mono flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{formatLastActivity(analytics.lastActivity)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Latest visitor ping</p>
          </div>
        </div>
      </div>

      {/* Visitor Traffic & Activity Chart Section */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        {/* Section Header with Time Range Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{t("analyticsTrafficActivity")}</h3>
              <p className="text-[11px] text-muted-foreground">
                Breakdown of unique users and total visits over time
              </p>
            </div>
          </div>

          {/* Time Range Toggle */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/60 self-start sm:self-auto text-xs">
            <button
              type="button"
              onClick={() => setTimeRange("daily")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                timeRange === "daily"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>{t("analyticsDaily")}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeRange("weekly")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                timeRange === "weekly"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              <span>{t("analyticsWeekly")}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeRange("monthly")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                timeRange === "monthly"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarRange className="h-3 w-3" />
              <span>{t("analyticsMonthly")}</span>
            </button>
          </div>
        </div>

        {/* Chart Legend & Current Hover Detail */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-primary" />
              <span className="text-muted-foreground">Unique Users</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-blue-400 dark:bg-blue-500" />
              <span className="text-muted-foreground">Total Visits</span>
            </div>
          </div>

          {hoveredBucket && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-secondary/80 border border-border/80 font-mono text-[11px] text-foreground">
              <span className="font-semibold text-primary">{hoveredBucket.label}:</span>
              <span>👥 {hoveredBucket.uniqueUsers} users</span>
              <span className="text-muted-foreground">|</span>
              <span>👀 {hoveredBucket.visits} visits</span>
            </div>
          )}
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4 pb-2">
          <div className="h-44 flex items-end gap-1.5 sm:gap-3 overflow-x-auto pb-2 no-scrollbar">
            {activeBuckets.map((bucket, idx) => {
              const userPct = Math.max(4, Math.round((bucket.uniqueUsers / maxVal) * 100));
              const visitPct = Math.max(4, Math.round((bucket.visits / maxVal) * 100));
              const isHovered = hoveredBucket?.periodKey === bucket.periodKey;

              return (
                <div
                  key={bucket.periodKey || idx}
                  onMouseEnter={() => setHoveredBucket(bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  className={`flex-1 min-w-[28px] sm:min-w-[36px] flex flex-col items-center gap-1.5 group cursor-pointer transition-all ${
                    isHovered ? "opacity-100 scale-105" : "opacity-90 hover:opacity-100"
                  }`}
                >
                  {/* Pair of vertical bars (Users & Visits) */}
                  <div className="w-full h-32 flex items-end justify-center gap-1 bg-secondary/30 rounded-lg p-1 relative border border-transparent group-hover:border-border">
                    {/* Unique Users Bar */}
                    <div
                      style={{ height: `${userPct}%` }}
                      className="w-1/2 rounded-xs bg-primary transition-all duration-300 group-hover:brightness-110"
                      title={`${bucket.label} - ${bucket.uniqueUsers} Unique Users`}
                    />
                    {/* Visits Bar */}
                    <div
                      style={{ height: `${visitPct}%` }}
                      className="w-1/2 rounded-xs bg-blue-400 dark:bg-blue-500 transition-all duration-300 group-hover:brightness-110"
                      title={`${bucket.label} - ${bucket.visits} Total Visits`}
                    />
                  </div>

                  {/* Label */}
                  <span className="text-[10px] text-muted-foreground group-hover:text-foreground font-medium text-center truncate max-w-full">
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
