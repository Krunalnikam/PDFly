import { recordVisitServerFn } from "./analytics-server";

const VISITOR_ID_KEY = "pdfmaker_anon_visitor_id";
const SESSION_ID_KEY = "pdfmaker_anon_session_id";
const LAST_PING_KEY = "pdfmaker_last_session_ping";

// 30 minutes in milliseconds for session expiration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
// Minimum 10 minutes between heartbeats in same session
const THROTTLE_PING_MS = 10 * 60 * 1000;

function generateRandomId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

/**
 * Initializes and records website visitor analytics in the background.
 * Privacy-friendly: Does not collect PII, passwords, documents, or personal data.
 */
export function trackWebsiteVisit(): void {
  if (typeof window === "undefined") return;

  const runTracking = async () => {
    try {
      // 1. Get or create persistent anonymous visitor ID
      let visitorId = "";
      try {
        visitorId = localStorage.getItem(VISITOR_ID_KEY) || "";
        if (!visitorId) {
          visitorId = generateRandomId("vis");
          localStorage.setItem(VISITOR_ID_KEY, visitorId);
        }
      } catch {
        // Fallback if localStorage is disabled
        visitorId = generateRandomId("vis_tmp");
      }

      // 2. Check session status
      const now = Date.now();
      let sessionId = "";
      let isNewSession = false;

      try {
        const storedSession = sessionStorage.getItem(SESSION_ID_KEY);
        const lastPingStr = sessionStorage.getItem(LAST_PING_KEY);
        const lastPing = lastPingStr ? parseInt(lastPingStr, 10) : 0;

        if (!storedSession || isNaN(lastPing) || now - lastPing > SESSION_TIMEOUT_MS) {
          // New session
          sessionId = generateRandomId("ses");
          sessionStorage.setItem(SESSION_ID_KEY, sessionId);
          sessionStorage.setItem(LAST_PING_KEY, String(now));
          isNewSession = true;
        } else {
          sessionId = storedSession;
          // If within session and recently pinged within throttle window, skip redundant calls
          if (now - lastPing < THROTTLE_PING_MS) {
            return;
          }
          sessionStorage.setItem(LAST_PING_KEY, String(now));
          isNewSession = false;
        }
      } catch {
        sessionId = generateRandomId("ses_tmp");
        isNewSession = true;
      }

      // 3. Dispatch to server in background
      await recordVisitServerFn({
        data: {
          visitorId,
          sessionId,
          isNewSession,
        },
      });
    } catch {
      // Silently ignore analytics network failures to maintain smooth user experience
    }
  };

  // Run non-blocking when browser is idle
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      runTracking();
    });
  } else {
    setTimeout(runTracking, 500);
  }
}
