import { createServerFn } from "@tanstack/react-start";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export type FeedbackType = "bug" | "feature" | "improvement" | "general";

export interface StoredFeedbackItem {
  id: string;
  type: FeedbackType;
  rating: number; // 1 to 5
  message: string;
  email?: string;
  timestamp: string; // ISO 8601
  language: string;
}

export interface FeedbackStats {
  total: number;
  averageRating: number;
  bugsCount: number;
  featuresCount: number;
  improvementsCount: number;
  generalCount: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");

// Helper to get or fallback admin key
function getAdminKey(): string {
  return process.env.FEEDBACK_ADMIN_KEY?.trim() || "pdfmaker-admin";
}

// Helper to ensure data file exists and read contents safely
async function readFeedbacksFromFile(): Promise<StoredFeedbackItem[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(FEEDBACK_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error("Error reading feedback file:", err);
    return [];
  }
}

// Helper to write feedback file safely
async function writeFeedbacksToFile(items: StoredFeedbackItem[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(items, null, 2), "utf-8");
}

/**
 * Server Function: Submit new student feedback (Public CREATE only)
 */
export const submitFeedbackServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid request body");
    }
    const d = data as Record<string, unknown>;
    const type = String(d.type || "general") as FeedbackType;
    const rating = Math.min(5, Math.max(1, Math.round(Number(d.rating) || 5)));
    const message = String(d.message || "").trim();
    const email = d.email ? String(d.email).trim() : undefined;
    const language = String(d.language || "en");

    if (!message) {
      throw new Error("Feedback message cannot be empty");
    }
    if (message.length > 1000) {
      throw new Error("Feedback message exceeds 1000 characters limit");
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Invalid email address format");
      }
    }

    const validTypes: FeedbackType[] = ["bug", "feature", "improvement", "general"];
    const resolvedType = validTypes.includes(type) ? type : "general";

    return {
      type: resolvedType,
      rating,
      message,
      email,
      language,
    };
  })
  .handler(async ({ data }) => {
    const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const newItem: StoredFeedbackItem = {
      id,
      type: data.type,
      rating: data.rating,
      message: data.message,
      email: data.email,
      timestamp,
      language: data.language,
    };

    const existing = await readFeedbacksFromFile();
    // Newest first
    const updated = [newItem, ...existing];
    await writeFeedbacksToFile(updated);

    // Check for owner notification email setting
    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL || process.env.FEEDBACK_OWNER_EMAIL;
    if (ownerEmail) {
      console.log(
        `[FEEDBACK OWNER NOTIFICATION] 📧 New Feedback #${id} sent by ${data.email || "Anonymous Student"} -> Owner (${ownerEmail}) | Type: [${data.type.toUpperCase()}] | Rating: ${data.rating}/5 | Msg: "${data.message.substring(0, 80)}..."`,
      );
    }

    return {
      success: true,
      id,
    };
  });

/**
 * Server Function: Verify Admin Passkey
 */
export const verifyAdminKeyServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { adminKey?: string };
    return {
      adminKey: String(d?.adminKey || "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const expectedKey = getAdminKey();
    const isAuthorized = Boolean(data.adminKey && data.adminKey === expectedKey);
    return {
      authorized: isAuthorized,
    };
  });

/**
 * Server Function: Fetch all feedback items for Admin Dashboard (Owner ONLY)
 */
export const getAdminFeedbackListServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { adminKey?: string; filterType?: string };
    return {
      adminKey: String(d?.adminKey || "").trim(),
      filterType: d?.filterType ? String(d.filterType) : "all",
    };
  })
  .handler(async ({ data }) => {
    const expectedKey = getAdminKey();
    if (!data.adminKey || data.adminKey !== expectedKey) {
      throw new Error("Unauthorized: Invalid Admin Security Key");
    }

    const items = await readFeedbacksFromFile();

    // Calculate statistics
    const total = items.length;
    const totalRatingSum = items.reduce((acc, item) => acc + item.rating, 0);
    const averageRating = total > 0 ? Number((totalRatingSum / total).toFixed(1)) : 0;
    const bugsCount = items.filter((i) => i.type === "bug").length;
    const featuresCount = items.filter((i) => i.type === "feature").length;
    const improvementsCount = items.filter((i) => i.type === "improvement").length;
    const generalCount = items.filter((i) => i.type === "general").length;

    const stats: FeedbackStats = {
      total,
      averageRating,
      bugsCount,
      featuresCount,
      improvementsCount,
      generalCount,
    };

    let filtered = items;
    if (data.filterType && data.filterType !== "all") {
      filtered = items.filter((i) => i.type === data.filterType);
    }

    return {
      success: true,
      stats,
      items: filtered,
    };
  });

/**
 * Server Function: Delete a feedback item (Owner ONLY)
 */
export const deleteFeedbackServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { adminKey?: string; id?: string };
    return {
      adminKey: String(d?.adminKey || "").trim(),
      id: String(d?.id || "").trim(),
    };
  })
  .handler(async ({ data }) => {
    const expectedKey = getAdminKey();
    if (!data.adminKey || data.adminKey !== expectedKey) {
      throw new Error("Unauthorized: Invalid Admin Security Key");
    }

    const items = await readFeedbacksFromFile();
    const updated = items.filter((i) => i.id !== data.id);
    await writeFeedbacksToFile(updated);

    return {
      success: true,
    };
  });
