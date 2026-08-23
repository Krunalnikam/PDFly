import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Trash2,
  Filter,
  Star,
  Bug,
  Lightbulb,
  Sparkles,
  Heart,
  Mail,
  Calendar,
  Lock,
  LogOut,
  AlertCircle,
  Loader2,
  Languages,
  ArrowLeft,
  BarChart3,
  MessageSquareQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import {
  getAdminFeedbackListServerFn,
  deleteFeedbackServerFn,
  verifyAdminKeyServerFn,
  type StoredFeedbackItem,
  type FeedbackStats,
  type FeedbackType,
} from "@/lib/feedback-server";
import { getAdminAnalyticsServerFn, type AnalyticsSummary } from "@/lib/analytics-server";
import { AdminAnalyticsView } from "@/components/AdminAnalyticsView";

export const Route = createFileRoute("/admin")({
  component: AdminDashboardPage,
});

const ADMIN_STORAGE_KEY = "pdfmaker_admin_passkey";

function AdminDashboardPage() {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<"analytics" | "feedback">("analytics");
  const [passkeyInput, setPasskeyInput] = useState("");
  const [activePasskey, setActivePasskey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const [items, setItems] = useState<StoredFeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(
    async (key: string, filter: string) => {
      setIsLoadingList(true);
      setIsLoadingAnalytics(true);
      try {
        const [feedbackRes, analyticsRes] = await Promise.all([
          getAdminFeedbackListServerFn({
            data: {
              adminKey: key,
              filterType: filter,
            },
          }),
          getAdminAnalyticsServerFn({
            data: {
              adminKey: key,
            },
          }),
        ]);

        if (feedbackRes && feedbackRes.success) {
          setItems(feedbackRes.items);
          setStats(feedbackRes.stats);
        }

        if (analyticsRes && analyticsRes.success) {
          setAnalytics(analyticsRes.analytics);
        }

        setAuthError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load admin data";
        if (msg.toLowerCase().includes("unauthorized")) {
          setActivePasskey(null);
          try {
            sessionStorage.removeItem(ADMIN_STORAGE_KEY);
          } catch {
            // ignore
          }
          setAuthError(t("adminInvalidKey"));
        } else {
          setAuthError(msg);
        }
      } finally {
        setIsLoadingList(false);
        setIsLoadingAnalytics(false);
      }
    },
    [t],
  );

  // Restore stored session key
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        setActivePasskey(saved);
        loadData(saved, selectedFilter);
      }
    } catch {
      // ignore
    }
  }, [loadData, selectedFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passkeyInput.trim();
    if (!trimmed) return;

    setIsVerifying(true);
    setAuthError(null);

    try {
      const verifyRes = await verifyAdminKeyServerFn({
        data: { adminKey: trimmed },
      });

      if (verifyRes && verifyRes.authorized) {
        setActivePasskey(trimmed);
        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEY, trimmed);
        } catch {
          // ignore
        }
        await loadData(trimmed, selectedFilter);
      } else {
        setAuthError(t("adminInvalidKey"));
      }
    } catch {
      setAuthError(t("adminInvalidKey"));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    setActivePasskey(null);
    setPasskeyInput("");
    setItems([]);
    setStats(null);
    setAnalytics(null);
    setAuthError(null);
    try {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    if (activePasskey) {
      loadData(activePasskey, filter);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activePasskey) return;
    if (!window.confirm(t("adminDeleteConfirm"))) return;

    setDeletingId(id);
    try {
      await deleteFeedbackServerFn({
        data: {
          adminKey: activePasskey,
          id,
        },
      });
      // Refresh list
      await loadData(activePasskey, selectedFilter);
    } catch (err) {
      console.error("Failed to delete feedback:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const getTypeMeta = (type: FeedbackType) => {
    switch (type) {
      case "bug":
        return {
          icon: Bug,
          label: t("feedbackTypeBug"),
          badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400",
        };
      case "feature":
        return {
          icon: Lightbulb,
          label: t("feedbackTypeFeature"),
          badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
        };
      case "improvement":
        return {
          icon: Sparkles,
          label: t("feedbackTypeImprovement"),
          badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
        };
      case "general":
      default:
        return {
          icon: Heart,
          label: t("feedbackTypeGeneral"),
          badgeClass:
            "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
        };
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to App</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                {t("adminDashboard")}
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                PDFMaker Owner Administration
              </p>
            </div>
          </div>
        </div>

        {activePasskey && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadData(activePasskey, selectedFilter)}
              disabled={isLoadingList || isLoadingAnalytics}
              className="h-8 gap-1.5 text-xs"
              title={t("adminRefresh")}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isLoadingList || isLoadingAnalytics ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">{t("adminRefresh")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
              title={t("adminLogoutBtn")}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("adminLogoutBtn")}</span>
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        {!activePasskey ? (
          /* Login Screen */
          <div className="max-w-md mx-auto py-12 px-6 rounded-2xl border border-border bg-card shadow-lg flex flex-col items-center text-center space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
              <Lock className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">{t("adminAuthTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("adminAuthDesc")}</p>
            </div>

            {authError && (
              <div className="w-full flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-left">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="w-full space-y-4 pt-2">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>{t("adminPasskeyLabel")}</span>
                </label>
                <Input
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => {
                    setPasskeyInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder={t("adminPasskeyPlaceholder")}
                  className="text-sm bg-background border-border/80"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isVerifying || !passkeyInput.trim()}
                className="w-full font-semibold shadow-sm text-xs py-4"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    <span>Verifying Passkey...</span>
                  </>
                ) : (
                  <span>{t("adminLoginBtn")}</span>
                )}
              </Button>
            </form>
          </div>
        ) : (
          /* Dashboard Content with Section Tabs */
          <div className="space-y-6">
            {/* Dashboard Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-border/80 pb-3">
              <button
                type="button"
                id="tab-admin-analytics"
                onClick={() => setActiveTab("analytics")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "analytics"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t("adminTabAnalytics")}</span>
              </button>

              <button
                type="button"
                id="tab-admin-feedback"
                onClick={() => setActiveTab("feedback")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "feedback"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <MessageSquareQuote className="h-4 w-4" />
                <span>{t("adminTabFeedback")}</span>
                {stats && stats.total > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeTab === "feedback"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {stats.total}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: Website Analytics */}
            {activeTab === "analytics" ? (
              <AdminAnalyticsView analytics={analytics} isLoading={isLoadingAnalytics} />
            ) : (
              /* Tab 2: Feedback */
              <div className="space-y-6">
                {/* Stats Bar */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminTotalFeedback")}
                      </span>
                      <div className="text-2xl sm:text-3xl font-bold text-foreground mt-1 font-mono">
                        {stats.total}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminAverageRating")}
                      </span>
                      <div className="text-2xl sm:text-3xl font-bold text-amber-500 mt-1 flex items-center gap-1 font-mono">
                        <span>{stats.averageRating}</span>
                        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminFilterBugs")}
                      </span>
                      <div className="text-2xl sm:text-3xl font-bold text-rose-500 mt-1 font-mono">
                        {stats.bugsCount}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminFilterFeatures")}
                      </span>
                      <div className="text-2xl sm:text-3xl font-bold text-primary mt-1 font-mono">
                        {stats.featuresCount}
                      </div>
                    </div>
                  </div>
                )}

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0 mr-1" />
                  {[
                    { id: "all", label: t("adminFilterAll") },
                    { id: "bug", label: t("adminFilterBugs") },
                    { id: "feature", label: t("adminFilterFeatures") },
                    { id: "improvement", label: t("adminFilterImprovements") },
                    { id: "general", label: t("adminFilterGeneral") },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFilterChange(f.id)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                        selectedFilter === f.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card text-muted-foreground border-border/80 hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Submissions List */}
                {isLoadingList ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <span className="text-xs">Loading feedback submissions from database...</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground border border-dashed rounded-2xl border-border/80 bg-card/40">
                    <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedFilter === "all"
                          ? t("adminNoFeedback")
                          : t("adminNoFeedbackMatch")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Student feedback submissions will show up here automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {items.map((item) => {
                      const meta = getTypeMeta(item.type);
                      const Icon = meta.icon;
                      const formattedDate = new Date(item.timestamp).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });

                      return (
                        <div
                          key={item.id}
                          className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors space-y-3 shadow-xs"
                        >
                          {/* Top Info */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className={`gap-1 text-xs font-semibold py-0.5 px-2.5 ${meta.badgeClass}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{meta.label}</span>
                              </Badge>

                              {/* Rating Stars */}
                              <div
                                className="flex items-center gap-0.5"
                                title={`${item.rating} / 5`}
                              >
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${
                                      star <= item.rating
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-muted-foreground/30 fill-transparent"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{formattedDate}</span>
                              </span>

                              <span className="flex items-center gap-1 uppercase font-mono text-[10px] bg-secondary px-2 py-0.5 rounded font-semibold">
                                <Languages className="h-3 w-3" />
                                <span>{item.language}</span>
                              </span>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                disabled={deletingId === item.id}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title={t("adminDeleteConfirm")}
                              >
                                {deletingId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Message */}
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                            {item.message}
                          </p>

                          {/* Email if available */}
                          {item.email && (
                            <div className="pt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                              <Mail className="h-3.5 w-3.5 text-primary/70" />
                              <a
                                href={`mailto:${encodeURIComponent(item.email)}`}
                                className="underline hover:opacity-80 font-mono"
                              >
                                {item.email}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
