import React, { useState, useEffect } from "react";
import {
  MessageSquareQuote,
  Star,
  Sparkles,
  Bug,
  Lightbulb,
  Heart,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Send,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { submitFeedback, type FeedbackType } from "@/lib/feedback";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackTypeLabelKey =
  "feedbackTypeFeature" | "feedbackTypeBug" | "feedbackTypeImprovement" | "feedbackTypeGeneral";

const FEEDBACK_TYPES: Array<{
  id: FeedbackType;
  labelKey: FeedbackTypeLabelKey;
  icon: React.ElementType;
  colorClass: string;
}> = [
  {
    id: "bug",
    labelKey: "feedbackTypeBug",
    icon: Bug,
    colorClass: "text-rose-500",
  },
  {
    id: "feature",
    labelKey: "feedbackTypeFeature",
    icon: Lightbulb,
    colorClass: "text-amber-500",
  },
  {
    id: "improvement",
    labelKey: "feedbackTypeImprovement",
    icon: Sparkles,
    colorClass: "text-blue-500",
  },
  {
    id: "general",
    labelKey: "feedbackTypeGeneral",
    icon: Heart,
    colorClass: "text-emerald-500",
  },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t, language } = useLanguage();

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("improvement");
  const [rating, setRating] = useState<number>(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form when opened fresh
  useEffect(() => {
    if (isOpen) {
      setFeedbackType("improvement");
      setRating(5);
      setHoveredRating(null);
      setMessage("");
      setEmail("");
      setIsSubmitting(false);
      setIsSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleRatingClick = (val: number) => {
    setRating(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setErrorMessage(t("feedbackEmptyError"));
      return;
    }

    if (trimmedMsg.length > 1000) {
      setErrorMessage("Feedback message is too long (maximum 1000 characters).");
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setErrorMessage(t("feedbackEmailInvalid"));
        return;
      }
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await submitFeedback({
        type: feedbackType,
        rating,
        message: trimmedMsg,
        email: trimmedEmail || undefined,
        language,
      });

      if (result.success) {
        setIsSuccess(true);
      } else {
        setErrorMessage(result.error || t("feedbackSubmitError"));
      }
    } catch {
      setErrorMessage(t("feedbackSubmitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setIsSuccess(false);
    setMessage("");
    setErrorMessage(null);
    setRating(5);
  };

  const displayRating = hoveredRating !== null ? hoveredRating : rating;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        id="modal-feedback"
        className="sm:max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/70 bg-secondary/30">
          <DialogHeader className="text-left space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <MessageSquareQuote className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {t("feedbackModalTitle")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t("feedbackModalSubtitle")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isSuccess ? (
            /* Success State */
            <div
              id="feedback-success-state"
              className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in-50 zoom-in-95 duration-200"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-500/10 shadow-sm">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-bold text-foreground">{t("feedbackSuccessTitle")}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("feedbackSuccessDesc")}
                </p>
              </div>

              <div className="pt-3 w-full max-w-xs flex flex-col gap-2">
                <Button
                  id="btn-feedback-done"
                  type="button"
                  size="default"
                  onClick={onClose}
                  className="w-full font-semibold shadow-sm"
                >
                  {t("done")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForAnother}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("sendAnotherFeedback")}
                </Button>
              </div>
            </div>
          ) : (
            /* Main Feedback Form */
            <form id="feedback-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Error Banner */}
              {errorMessage && (
                <div
                  id="feedback-error-banner"
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in duration-150"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">{errorMessage}</div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="shrink-0 text-destructive/70 hover:text-destructive"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* 1. Feedback Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>1. {t("feedbackTypeLabel")}</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  {FEEDBACK_TYPES.map((item) => {
                    const isSelected = feedbackType === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`btn-feedback-type-${item.id}`}
                        onClick={() => {
                          setFeedbackType(item.id);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary"
                            : "border-border/80 bg-secondary/30 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : item.colorClass}`}
                        />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Rating (1–5 Stars) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2. {t("ratingLabel")}
                  </Label>
                  <span className="text-xs font-semibold font-mono text-primary">
                    {displayRating} / 5
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border/70 bg-secondary/20 justify-center sm:justify-start"
                  role="radiogroup"
                  aria-label="Rating out of 5 stars"
                >
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled = starValue <= displayRating;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        id={`btn-star-rating-${starValue}`}
                        onClick={() => handleRatingClick(starValue)}
                        onMouseEnter={() => setHoveredRating(starValue)}
                        onMouseLeave={() => setHoveredRating(null)}
                        className="p-1 rounded-lg transition-transform hover:scale-115 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
                        title={`${starValue} / 5`}
                      >
                        <Star
                          className={`h-6 w-6 sm:h-7 sm:w-7 transition-colors ${
                            isFilled
                              ? "fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                              : "fill-transparent text-muted-foreground/40 hover:text-amber-400/80"
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="ml-2 text-xs font-medium text-muted-foreground hidden xs:inline">
                    {displayRating === 5
                      ? "⭐⭐⭐⭐⭐"
                      : displayRating >= 4
                        ? "⭐⭐⭐⭐"
                        : displayRating >= 3
                          ? "⭐⭐⭐"
                          : displayRating >= 2
                            ? "⭐⭐"
                            : "⭐"}
                  </span>
                </div>
              </div>

              {/* 3. Feedback Message */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="feedback-message"
                    className="text-xs font-semibold flex items-center gap-1"
                  >
                    <span>3. {t("feedbackMessageLabel")}</span>
                  </Label>
                  <span
                    className={`text-[11px] font-mono ${
                      message.length > 900
                        ? "text-amber-500 font-semibold"
                        : message.length >= 1000
                          ? "text-destructive font-bold"
                          : "text-muted-foreground"
                    }`}
                  >
                    {t("charCount", { current: message.length })}
                  </span>
                </div>

                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={t("feedbackMessagePlaceholder")}
                  maxLength={1000}
                  rows={4}
                  className="resize-y text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-primary min-h-[90px]"
                  required
                />
              </div>

              {/* 4. Optional Contact Email */}
              <div className="space-y-1.5 pt-1">
                <Label
                  htmlFor="feedback-email"
                  className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
                >
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  <span>4. {t("feedbackEmailLabel")}</span>
                </Label>
                <Input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={t("feedbackEmailPlaceholder")}
                  maxLength={120}
                  className="text-xs sm:text-sm bg-background border-border/80"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {t("feedbackEmailHelp")}
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <Button
                  id="btn-submit-feedback"
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="w-full gap-2 font-semibold shadow-md py-5 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("submittingFeedback")}</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>{t("submitFeedback")}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
