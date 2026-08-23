import React, { useState, useEffect, useCallback } from "react";
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
  BarChart3,
  MessageSquareQuote,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

interface AdminFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ADMIN_STORAGE_KEY = "pdfmaker_admin_passkey";

export function AdminFeedbackModal({ isOpen, onClose }: AdminFeedbackModalProps) {
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
    if (isOpen) {
      try {
        const saved = sessionStorage.getItem(ADMIN_STORAGE_KEY);
        if (saved) {
          setActivePasskey(saved);
          loadData(saved, selectedFilter);
        }
      } catch {
        // ignore
      }
    }
  }, [isOpen, loadData, selectedFilter]);

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        id="modal-admin-feedback"
        className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border/80 bg-secondary/30 flex items-center justify-between">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span>{t("adminDashboard")}</span>
                  {activePasskey && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 py-0 h-4"
                    >
                      Live
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {t("adminSecurityNotice")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activePasskey && (
            <div className="flex items-center gap-2">
              <Button
                id="btn-admin-refresh"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadData(activePasskey, selectedFilter)}
                disabled={isLoadingList || isLoadingAnalytics}
                className="h-8 gap-1 text-xs"
                title={t("adminRefresh")}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoadingList || isLoadingAnalytics ? "animate-spin" : ""}`}
                />
                <span className="hidden xs:inline">{t("adminRefresh")}</span>
              </Button>
              <Button
                id="btn-admin-logout"
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                title={t("adminLogoutBtn")}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {!activePasskey ? (
            /* Auth Login Screen */
            <div className="py-6 max-w-sm mx-auto flex flex-col items-center text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
                <Lock className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">{t("adminAuthTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("adminAuthDesc")}</p>
              </div>

              {authError && (
                <div className="w-full flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-left">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="w-full space-y-3 pt-2">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>{t("adminPasskeyLabel")}</span>
                  </label>
                  <Input
                    id="admin-passkey-input"
                    type="password"
                    value={passkeyInput}
                    onChange={(e) => {
                      setPasskeyInput(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    placeholder={t("adminPasskeyPlaceholder")}
                    className="text-xs sm:text-sm bg-background border-border/80"
                    autoFocus
                    required
                  />
                </div>

                <Button
                  id="btn-admin-submit-passkey"
                  type="submit"
                  disabled={isVerifying || !passkeyInput.trim()}
                  className="w-full font-semibold shadow-sm text-xs py-4"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>{t("adminLoginBtn")}</span>
                  )}
                </Button>
              </form>
            </div>
          ) : (
            /* Authenticated Admin Dashboard with Section Tabs */
            <div className="space-y-5">
              {/* Dashboard Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-border/80 pb-2">
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

              {/* Tab 1: Website User Analytics */}
              {activeTab === "analytics" ? (
                <AdminAnalyticsView analytics={analytics} isLoading={isLoadingAnalytics} />
              ) : (
                /* Tab 2: Student Feedback */
                <div className="space-y-5">
                  {/* Stats Bar */}
                  {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-xl border border-border/80 bg-secondary/30">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {t("adminTotalFeedback")}
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 font-mono">
                          {stats.total}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-border/80 bg-secondary/30">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {t("adminAverageRating")}
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-amber-500 mt-0.5 flex items-center gap-1 font-mono">
                          <span>{stats.averageRating}</span>
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-border/80 bg-secondary/30">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {t("adminFilterBugs")}
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-rose-500 mt-0.5 font-mono">
                          {stats.bugsCount}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-border/80 bg-secondary/30">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {t("adminFilterFeatures")}
                        </span>
                        <div className="text-xl sm:text-2xl font-bold text-primary mt-0.5 font-mono">
                          {stats.featuresCount}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
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
                        className={`px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap transition-all ${
                          selectedFilter === f.id
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-secondary/40 text-muted-foreground border-border/80 hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Items List */}
                  {isLoadingList ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs">Loading feedback submissions...</span>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground border border-dashed rounded-xl border-border/80">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground/50" />
                      <span className="text-xs font-medium">
                        {selectedFilter === "all"
                          ? t("adminNoFeedback")
                          : t("adminNoFeedbackMatch")}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
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
                            className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors space-y-2.5 shadow-xs"
                          >
                            {/* Top info line */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`gap-1 text-xs font-semibold py-0.5 px-2 ${meta.badgeClass}`}
                                >
                                  <Icon className="h-3 w-3" />
                                  <span>{meta.label}</span>
                                </Badge>

                                {/* Stars */}
                                <div
                                  className="flex items-center gap-0.5"
                                  title={`${item.rating} / 5`}
                                >
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-3.5 w-3.5 ${
                                        star <= item.rating
                                          ? "fill-amber-400 text-amber-400"
                                          : "text-muted-foreground/30 fill-transparent"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formattedDate}</span>
                                </span>

                                <span className="flex items-center gap-1 uppercase font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                                  <Languages className="h-2.5 w-2.5" />
                                  <span>{item.language}</span>
                                </span>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title={t("adminDeleteConfirm")}
                                >
                                  {deletingId === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Message content */}
                            <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                              {item.message}
                            </p>

                            {/* Optional Student Email */}
                            {item.email && (
                              <div className="pt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                                <Mail className="h-3.5 w-3.5 text-primary/70" />
                                <a
                                  href={`mailto:${encodeURIComponent(item.email)}`}
                                  className="underline hover:opacity-80"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
