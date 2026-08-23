import { createServerFn } from "@tanstack/react-start";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface VisitorRecord {
  visitorId: string;
  firstSeen: string; // ISO 8601
  lastSeen: string; // ISO 8601
  totalVisits: number;
  daysVisited: string[]; // List of YYYY-MM-DD
}

export interface VisitEvent {
  id: string;
  visitorId: string;
  sessionId: string;
  timestamp: string; // ISO 8601
  date: string; // YYYY-MM-DD
}

export interface StoredAnalyticsData {
  visitors: Record<string, VisitorRecord>;
  visits: VisitEvent[];
  lastActivity: string; // ISO 8601
}

export interface ActivityBucket {
  periodKey: string;
  label: string;
  subLabel?: string;
  uniqueUsers: number;
  visits: number;
}

export interface AnalyticsSummary {
  totalUsers: number;
  totalVisits: number;
  todayUsers: number;
  todayVisits: number;
  lastActivity: string | null;
  dailyVisitors: ActivityBucket[];
  weeklyVisitors: ActivityBucket[];
  monthlyVisitors: ActivityBucket[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");

function getAdminKey(): string {
  return process.env.FEEDBACK_ADMIN_KEY?.trim() || "pdfmaker-admin";
}

// Get current date string formatted as YYYY-MM-DD
function getLocalDateString(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}

// Helper to ensure data file exists and read analytics safely
async function readAnalyticsFromFile(): Promise<StoredAnalyticsData> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(ANALYTICS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      return {
        visitors: parsed.visitors || {},
        visits: Array.isArray(parsed.visits) ? parsed.visits : [],
        lastActivity: parsed.lastActivity || new Date().toISOString(),
      };
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Error reading analytics file:", err);
    }
  }

  return {
    visitors: {},
    visits: [],
    lastActivity: new Date().toISOString(),
  };
}

// Helper to write analytics file safely
async function writeAnalyticsToFile(data: StoredAnalyticsData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Keep maximum recent 5,000 visit events to prevent unbounded file growth
  if (data.visits.length > 5000) {
    data.visits = data.visits.slice(-5000);
  }
  await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Server Function: Record Visitor Activity / Session (Public Non-PII ping)
 */
export const recordVisitServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid request body");
    }
    const d = data as Record<string, unknown>;
    const rawVisitorId = String(d.visitorId || "").trim();
    const rawSessionId = String(d.sessionId || "").trim();
    const isNewSession = Boolean(d.isNewSession);

    // Sanitize and ensure format
    const visitorId = rawVisitorId.slice(0, 64) || `v_${Date.now()}`;
    const sessionId = rawSessionId.slice(0, 64) || `s_${Date.now()}`;

    return {
      visitorId,
      sessionId,
      isNewSession,
    };
  })
  .handler(async ({ data }) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = getLocalDateString(now);

    const store = await readAnalyticsFromFile();

    const existingVisitor = store.visitors[data.visitorId];
    if (existingVisitor) {
      existingVisitor.lastSeen = nowIso;
      if (!existingVisitor.daysVisited.includes(todayStr)) {
        existingVisitor.daysVisited.push(todayStr);
      }
      if (data.isNewSession) {
        existingVisitor.totalVisits += 1;
      }
    } else {
      store.visitors[data.visitorId] = {
        visitorId: data.visitorId,
        firstSeen: nowIso,
        lastSeen: nowIso,
        totalVisits: 1,
        daysVisited: [todayStr],
      };
    }

    if (data.isNewSession) {
      store.visits.push({
        id: `vt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        visitorId: data.visitorId,
        sessionId: data.sessionId,
        timestamp: nowIso,
        date: todayStr,
      });
    }

    store.lastActivity = nowIso;

    await writeAnalyticsToFile(store);

    return {
      success: true,
      recorded: true,
    };
  });

/**
 * Server Function: Get Admin Analytics Summary (Owner ONLY)
 */
export const getAdminAnalyticsServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { adminKey?: string };
    return {
      adminKey: String(d?.adminKey || "").trim(),
    };
  })
  .handler(async ({ data }): Promise<{ success: boolean; analytics: AnalyticsSummary }> => {
    const expectedKey = getAdminKey();
    if (!data.adminKey || data.adminKey !== expectedKey) {
      throw new Error("Unauthorized: Invalid Admin Security Key");
    }

    const store = await readAnalyticsFromFile();
    const now = new Date();
    const todayStr = getLocalDateString(now);

    const allVisitors = Object.values(store.visitors);
    const totalUsers = allVisitors.length;
    const totalVisits = store.visits.length;

    // Today's metrics
    const todayUsers = allVisitors.filter((v) => v.daysVisited.includes(todayStr)).length;
    const todayVisits = store.visits.filter((v) => v.date === todayStr).length;

    // 1. Daily visitors (Past 14 days)
    const dailyVisitors: ActivityBucket[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      const monthShort = d.toLocaleString("en-US", { month: "short" });
      const dayNum = d.getDate();

      const uniqueInDay = allVisitors.filter((v) => v.daysVisited.includes(dateStr)).length;
      const visitsInDay = store.visits.filter((v) => v.date === dateStr).length;

      dailyVisitors.push({
        periodKey: dateStr,
        label: `${monthShort} ${dayNum}`,
        subLabel: d.toLocaleString("en-US", { weekday: "short" }),
        uniqueUsers: uniqueInDay,
        visits: visitsInDay,
      });
    }

    // 2. Weekly visitors (Past 8 weeks)
    const weeklyVisitors: ActivityBucket[] = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7 + weekStart.getDay()));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const startStr = getLocalDateString(weekStart);
      const endStr = getLocalDateString(weekEnd);

      const startMonth = weekStart.toLocaleString("en-US", { month: "short" });
      const endMonth = weekEnd.toLocaleString("en-US", { month: "short" });

      const label =
        startMonth === endMonth
          ? `${startMonth} ${weekStart.getDate()}-${weekEnd.getDate()}`
          : `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;

      const visitsInWeek = store.visits.filter((v) => {
        const vt = new Date(v.timestamp);
        return vt >= weekStart && vt <= weekEnd;
      });

      const uniqueUsersInWeek = allVisitors.filter((v) => {
        return v.daysVisited.some((d) => d >= startStr && d <= endStr);
      }).length;

      weeklyVisitors.push({
        periodKey: `W_${startStr}`,
        label: w === 0 ? "This Week" : label,
        subLabel: `${startStr} to ${endStr}`,
        uniqueUsers: uniqueUsersInWeek,
        visits: visitsInWeek.length,
      });
    }

    // 3. Monthly visitors (Past 6 months)
    const monthlyVisitors: ActivityBucket[] = [];
    for (let m = 5; m >= 0; m--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = targetDate.toLocaleString("en-US", { month: "short", year: "numeric" });

      const uniqueInMonth = allVisitors.filter((v) => {
        return v.daysVisited.some((d) => d.startsWith(monthStr));
      }).length;

      const visitsInMonth = store.visits.filter((v) => v.date.startsWith(monthStr)).length;

      monthlyVisitors.push({
        periodKey: monthStr,
        label,
        uniqueUsers: uniqueInMonth,
        visits: visitsInMonth,
      });
    }

    const summary: AnalyticsSummary = {
      totalUsers,
      totalVisits,
      todayUsers,
      todayVisits,
      lastActivity:
        store.lastActivity ||
        (totalVisits > 0 ? store.visits[store.visits.length - 1].timestamp : null),
      dailyVisitors,
      weeklyVisitors,
      monthlyVisitors,
    };

    return {
      success: true,
      analytics: summary,
    };
  });
