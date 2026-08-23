import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Crop,
  Edit3,
  FileDown,
  GraduationCap,
  Hash,
  ImagePlus,
  Loader2,
  MessageSquareQuote,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  UserCheck,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  formatBytes,
  generateAssignmentPdf,
  QUALITY_PRESETS,
  type PdfQualityPreset,
  type UploadedImage,
  type PdfGenerationProgress,
} from "@/lib/assignment-pdf";
import {
  detectDocument,
  rotateImage,
  rotateQuad,
  warpQuad,
  type Quad,
  autoCropImage,
  FULL_QUAD,
} from "@/lib/page-scan";
import { DocumentScannerModal } from "@/components/DocumentScannerModal";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { FeedbackModal } from "@/components/FeedbackModal";
import { AdminFeedbackModal } from "@/components/AdminFeedbackModal";
import { SettingsMenu } from "@/components/SettingsMenu";
import { getSavedProfile, saveStudentProfile } from "@/lib/profile";
import { StudentProfile } from "@/types";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assignment PDF Maker — Photos to Submission PDF" },
      {
        name: "description",
        content:
          "Upload assignment photos, auto-detect document borders, perspective crop, add your student details, and download a submission PDF.",
      },
      { property: "og:title", content: "Assignment PDF Maker" },
      {
        property: "og:description",
        content:
          "Turn handwritten assignment photos into a ready-to-submit PDF with built-in document scanner auto-crop.",
      },
    ],
  }),
  component: Index,
});

type Errors = Partial<
  Record<"branch" | "enrollmentNumber" | "subject" | "examPhase" | "images", string>
>;

function Index() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [adminFeedbackModalOpen, setAdminFeedbackModalOpen] = useState(false);
  const [branchInput, setBranchInput] = useState("");
  const [enrollmentInput, setEnrollmentInput] = useState("");
  const [subject, setSubject] = useState("");
  const [examPhase, setExamPhase] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [smartFilterEnabled, setSmartFilterEnabled] = useState(false);
  const [qualityPreset, setQualityPreset] = useState<PdfQualityPreset>("compact");
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [scannerTarget, setScannerTarget] = useState<{
    image: UploadedImage;
    pageNumber: number;
  } | null>(null);

  const [generationProgress, setGenerationProgress] = useState<PdfGenerationProgress | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    fileName: string;
    size: number;
    originalSize?: number;
    pageCount: number;
    blob?: Blob;
  } | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  const activeBranch = profile ? profile.branch : branchInput.trim().toUpperCase();
  const activeEnrollmentNumber = profile ? profile.enrollmentNumber : enrollmentInput.trim();

  // Unsaved Work Protection detection
  const hasUnsavedImages = images.length > 0;
  const hasUnsavedFields =
    Boolean(subject.trim()) ||
    Boolean(examPhase.trim()) ||
    (!profile && (Boolean(branchInput.trim()) || Boolean(enrollmentInput.trim())));
  const hasUnsavedWork = (hasUnsavedImages || hasUnsavedFields) && result === null;

  // 1. Browser-level Unsaved Work Protection (page refresh, tab close, window close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = t("unsavedWorkWarning");
        return t("unsavedWorkWarning");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedWork, t]);

  // 2. SPA-level Unsaved Work Protection (in-app navigation, browser back)
  useBlocker({
    shouldBlockFn: () => {
      if (!hasUnsavedWork) return false;
      const shouldLeave = window.confirm(t("unsavedWorkWarning"));
      return !shouldLeave;
    },
  });

  const getProgressLabel = () => {
    if (!generationProgress) return t("generatingPdf");
    switch (generationProgress.stage) {
      case "preparing":
        return t("pdfStagePreparing");
      case "processing":
        return t("pdfStageProcessing", {
          current: generationProgress.current ?? 1,
          total: generationProgress.total ?? images.length,
        });
      case "creating":
        return t("pdfStageCreating");
      case "finalizing":
        return t("pdfStageFinalizing");
      case "ready":
        return t("pdfStageReady");
      default:
        return t("generatingPdf");
    }
  };

  // Load saved student profile from localStorage on mount
  useEffect(() => {
    const saved = getSavedProfile();
    if (saved) {
      setProfile(saved);
      setBranchInput(saved.branch);
      setEnrollmentInput(saved.enrollmentNumber);
    }
  }, []);

  const handleSaveProfile = (newProfile: StudentProfile) => {
    setProfile(newProfile);
    setBranchInput(newProfile.branch);
    setEnrollmentInput(newProfile.enrollmentNumber);
    setErrors((prev) => ({ ...prev, branch: undefined, enrollmentNumber: undefined }));
    notify(
      t("savedDetailsNotify", {
        branch: newProfile.branch,
        enrollment: newProfile.enrollmentNumber,
      }),
    );
  };

  // Clean up any created object URLs when the component unmounts to prevent memory leaks
  useEffect(() => {
    const urls = createdBlobUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      urls.clear();
    };
  }, []);

  const notify = (message: string) => setNotices((prev) => [message, ...prev].slice(0, 4));

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|gif|jfif|heic)$/i.test(f.name),
    );
    if (accepted.length === 0) return;

    // Map files in the exact sequence provided by the picker
    // Assign stable sequential IDs and preserve stable index positions
    const newImages: UploadedImage[] = accepted.map((file, idx) => {
      const id = `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`;
      const objectUrl = URL.createObjectURL(file);
      createdBlobUrlsRef.current.add(objectUrl);
      return {
        id,
        name: file.name,
        dataUrl: objectUrl,
        originalDataUrl: objectUrl,
        size: file.size,
        isCropped: false,
      };
    });

    // Automatically reverse the newly uploaded batch once so reverse-chronological photo picker batches (5,4,3,2,1) become (1,2,3,4,5)
    const reversedBatch = [...newImages].reverse();

    // CRITICAL: Append the new reversed batch strictly to the END of existing images (existing images are never re-reversed)
    setImages((prev) => [...prev, ...reversedBatch]);
    setErrors(({ images: _omit, ...rest }) => rest);
    setResult(null);

    if (inputRef.current) inputRef.current.value = "";

    // Asynchronously process the newly added images in-place with Auto Crop
    processAutoCropForImages(reversedBatch);
  };

  const processAutoCropForImages = async (targetImages: UploadedImage[]) => {
    if (targetImages.length === 0) return;

    const concurrency = Math.min(3, targetImages.length);
    let index = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (index < targetImages.length) {
        const item = targetImages[index++];
        if (!item) continue;
        try {
          const res = await autoCropImage(item.originalDataUrl);
          if (res.isCropped && res.quad) {
            // Update in-place by matching exact image ID, guaranteeing order remains unchanged
            setImages((prev) =>
              prev.map((img) =>
                img.id === item.id
                  ? {
                      ...img,
                      dataUrl: res.dataUrl,
                      isCropped: true,
                      currentQuad: res.quad,
                      confidence: res.confidence,
                    }
                  : img,
              ),
            );
          }
        } catch {
          // Keep original if auto-crop fails
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    });

    await Promise.all(workers);
  };

  const removeImage = (id: string) => {
    const target = images.find((image) => image.id === id);
    if (target) {
      if (target.dataUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(target.dataUrl);
          createdBlobUrlsRef.current.delete(target.dataUrl);
        } catch {
          // ignore
        }
      }
      if (target.originalDataUrl.startsWith("blob:") && target.originalDataUrl !== target.dataUrl) {
        try {
          URL.revokeObjectURL(target.originalDataUrl);
          createdBlobUrlsRef.current.delete(target.originalDataUrl);
        } catch {
          // ignore
        }
      }
    }
    setImages((prev) => prev.filter((image) => image.id !== id));
    if (scannerTarget?.image.id === id) {
      setScannerTarget(null);
    }
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    setImages((prev) => {
      const copy = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const [item] = copy.splice(index, 1);
      if (item) copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const reverseImagesOrder = () => {
    if (images.length < 2) return;
    setImages((prev) => [...prev].reverse());
    notify(t("orderReversedNotify", { count: images.length }));
  };

  const handleQuickRotate = async (id: string, degrees: 90 | -90) => {
    if (rotatingId || isBatchScanning) return;
    const img = images.find((i) => i.id === id);
    if (!img) return;

    setRotatingId(id);
    try {
      const nextDataUrl = await rotateImage(img.dataUrl, degrees);
      const nextOrigUrl =
        img.originalDataUrl === img.dataUrl
          ? nextDataUrl
          : await rotateImage(img.originalDataUrl, degrees);
      const nextQuad = img.currentQuad ? rotateQuad(img.currentQuad, degrees) : undefined;

      setImages((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                dataUrl: nextDataUrl,
                originalDataUrl: nextOrigUrl,
                currentQuad: nextQuad,
              }
            : item,
        ),
      );
      const pageIdx = images.findIndex((i) => i.id === id);
      const pageLabel = pageIdx >= 0 ? t("pageWord", { num: pageIdx + 1 }) : t("pageSingle");
      notify(
        t("pageRotatedNotify", {
          page: pageLabel,
          direction: degrees === 90 ? t("rotateRightDir") : t("rotateLeftDir"),
        }),
      );
    } catch {
      notify(t("rotateFailedNotify"));
    } finally {
      setRotatingId(null);
    }
  };

  const handleRevertToOriginal = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? {
              ...img,
              dataUrl: img.originalDataUrl,
              isCropped: false,
              currentQuad: undefined,
              confidence: undefined,
            }
          : img,
      ),
    );
    notify(t("revertedNotify"));
  };

  const handleApplyScannerCrop = (updated: {
    id: string;
    dataUrl: string;
    isCropped: boolean;
    currentQuad: Quad;
    confidence?: number;
  }) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === updated.id
          ? {
              ...img,
              dataUrl: updated.dataUrl,
              isCropped: updated.isCropped,
              currentQuad: updated.currentQuad,
              confidence: updated.confidence,
            }
          : img,
      ),
    );
    notify(t("cropAppliedNotify"));
  };

  // Batch auto-crop all uncropped images
  const handleBatchAutoCrop = async () => {
    if (images.length === 0 || isBatchScanning) return;
    setIsBatchScanning(true);
    let successCount = 0;
    let completedCount = 0;
    const total = images.length;
    try {
      setBatchProgress(t("autoCroppingPages"));
      const concurrency = Math.min(3, total);
      let idx = 0;

      const workers = Array.from({ length: concurrency }, async () => {
        while (idx < total) {
          const currentIdx = idx++;
          const item = images[currentIdx];
          if (!item) continue;

          try {
            const res = await autoCropImage(item.originalDataUrl);
            if (res.isCropped && res.quad) {
              setImages((prev) =>
                prev.map((img) =>
                  img.id === item.id
                    ? {
                        ...img,
                        dataUrl: res.dataUrl,
                        isCropped: true,
                        currentQuad: res.quad,
                        confidence: res.confidence,
                      }
                    : img,
                ),
              );
              successCount++;
            }
          } catch {
            // skip
          } finally {
            completedCount++;
            setBatchProgress(t("processingPage", { current: completedCount, total }));
          }
          await new Promise((r) => setTimeout(r, 0));
        }
      });

      await Promise.all(workers);
      notify(t("autoCropSuccessNotify", { count: successCount, total: images.length }));
    } finally {
      setIsBatchScanning(false);
      setBatchProgress("");
    }
  };

  const validate = () => {
    const next: Errors = {};
    if (!activeBranch) next.branch = t("branchRequiredError");
    if (!activeEnrollmentNumber) next.enrollmentNumber = t("enrollmentRequiredError");
    if (!subject.trim()) next.subject = t("subjectRequiredError");
    if (!examPhase.trim()) next.examPhase = t("examPhaseRequiredError");
    if (images.length === 0) next.images = t("uploadAtLeastOneError");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleGenerate = async () => {
    setGenerationError(null);
    setResult(null);
    if (!validate()) {
      if (!profile && (!activeBranch || !activeEnrollmentNumber)) {
        setProfileModalOpen(true);
      }
      return;
    }

    // If profile hasn't been saved yet to localStorage, save it now automatically
    if (!profile && activeBranch && activeEnrollmentNumber) {
      const saved = saveStudentProfile({
        branch: activeBranch,
        enrollmentNumber: activeEnrollmentNumber,
      });
      setProfile(saved);
    }

    setIsGenerating(true);
    setGenerationProgress({
      stage: "preparing",
      percent: 20,
      total: images.length,
    });

    try {
      const totalOriginalSize = images.reduce((acc, img) => acc + (img.size || 0), 0);
      const { blob, fileName } = await generateAssignmentPdf(
        {
          branch: activeBranch,
          enrollmentNumber: activeEnrollmentNumber,
          subject: subject.trim().toUpperCase(),
          examPhase: examPhase.trim().toUpperCase(),
        },
        images,
        smartFilterEnabled,
        qualityPreset,
        (progress) => {
          setGenerationProgress(progress);
        },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setResult({
        fileName,
        size: blob.size,
        originalSize: totalOriginalSize > 0 ? totalOriginalSize : undefined,
        pageCount: images.length,
        blob,
      });
      setGenerationProgress(null);
      notify(t("pdfCreatedNotify"));
    } catch (err: unknown) {
      console.error("PDF Generation error:", err);
      const msg = err instanceof Error ? err.message : t("pdfGenerateFailed");
      setGenerationError(msg);
      setGenerationProgress(null);
      setErrors((prev) => ({ ...prev, images: msg }));
      notify(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!result?.blob) return;
    const fileName = result.fileName || "assignment.pdf";
    const file = new File([result.blob], fileName, { type: "application/pdf" });

    // 1. Try native Web Share API with the PDF file
    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }

    // 2. Direct WhatsApp flow fallback: download PDF to device and open WhatsApp
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);

    window.open("https://api.whatsapp.com/send", "_blank", "noopener,noreferrer");
    notify(t("whatsappNotify"));
  };

  const handleManualDownload = () => {
    if (!result?.blob) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
              {t("appTagline")}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("appTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("appDescription")}</p>
          </div>

          {/* Top Actions: [ Settings ] [ 💬 Feedback ] [ Saved Profile ] */}
          <div className="shrink-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <SettingsMenu
              onOpenFeedback={() => setFeedbackModalOpen(true)}
              onOpenAdminFeedback={() => setAdminFeedbackModalOpen(true)}
            />

            <Button
              id="btn-open-feedback"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFeedbackModalOpen(true)}
              className="h-9 gap-1.5 text-xs font-medium border-border/80 bg-card text-foreground hover:bg-accent/50 shadow-xs"
              title={t("feedbackBtn")}
              aria-label={t("feedbackBtn")}
            >
              <MessageSquareQuote className="h-4 w-4 text-primary" />
              <span>💬 {t("feedbackBtn")}</span>
            </Button>

            {profile ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card p-2 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="text-left pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {t("savedProfile")}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-3.5 border-primary/40 text-primary"
                    >
                      {profile.branch}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground leading-tight">
                    {profile.enrollmentNumber}
                  </p>
                </div>
                <Button
                  id="btn-edit-profile-header"
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 border-l border-border pl-2"
                  onClick={() => setProfileModalOpen(true)}
                  title={t("editProfileTitle")}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{t("editProfile")}</span>
                </Button>
              </div>
            ) : (
              <Button
                id="btn-setup-profile-header"
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5 shadow-xs"
                onClick={() => setProfileModalOpen(true)}
              >
                <GraduationCap className="h-4 w-4" />
                <span>{t("saveStudentProfile")}</span>
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {/* Step 1: Upload photos */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3">
                <CardTitle className="text-lg">{t("step1Title")}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Smart Filter ON/OFF Toggle */}
                  <div
                    id="toggle-smart-filter-container"
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs"
                    title={t("smartFilterTooltip")}
                  >
                    <Wand2 className="h-3.5 w-3.5 text-primary" />
                    <Label
                      htmlFor="switch-smart-filter"
                      className="cursor-pointer text-xs font-semibold select-none flex items-center gap-1.5"
                    >
                      <span>{t("smartFilter")}</span>
                      <Badge
                        variant={smartFilterEnabled ? "default" : "secondary"}
                        className="text-[9px] px-1 py-0 h-4 font-bold uppercase tracking-wider"
                      >
                        {smartFilterEnabled ? t("on") : t("off")}
                      </Badge>
                    </Label>
                    <Switch
                      id="switch-smart-filter"
                      checked={smartFilterEnabled}
                      onCheckedChange={(checked) => setSmartFilterEnabled(checked)}
                      aria-label={t("smartFilter")}
                    />
                  </div>

                  {images.length > 0 && (
                    <Button
                      id="btn-autocrop-all"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBatchAutoCrop}
                      disabled={isBatchScanning}
                      className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 h-8"
                    >
                      {isBatchScanning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {batchProgress || t("scanningPages")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          {t("autoCropAll")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <label
                  htmlFor="assignment-files"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/40 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-secondary"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFiles(e.dataTransfer.files);
                  }}
                >
                  <ImagePlus className="h-8 w-8 text-primary" aria-hidden="true" />
                  <span className="mt-3 text-sm font-medium text-foreground">
                    {t("uploadPrompt")}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">{t("uploadSubtext")}</span>
                </label>
                <input
                  ref={inputRef}
                  id="assignment-files"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => handleFiles(event.target.files)}
                />
                {errors.images && <p className="mt-3 text-sm text-destructive">{errors.images}</p>}

                {/* Uploaded Images List with scanner triggers */}
                {images.length > 0 && (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("uploadedPagesHeader", { count: images.length })}
                      </p>
                      {images.length >= 2 && (
                        <Button
                          id="btn-reverse-page-order"
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={reverseImagesOrder}
                          disabled={isBatchScanning || isGenerating}
                          className="h-7 gap-1.5 px-2.5 text-xs font-medium text-foreground hover:bg-secondary border-border/80 cursor-pointer shadow-2xs"
                          title={t("reverseOrderTooltip")}
                        >
                          <ArrowUpDown className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{t("reverseOrder")}</span>
                        </Button>
                      )}
                    </div>
                    <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card">
                      {images.map((image, index) => (
                        <li
                          key={image.id}
                          className="flex flex-wrap items-center justify-between gap-3 p-3 sm:flex-nowrap"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-secondary/40">
                              <img
                                src={image.dataUrl}
                                alt={`Page ${index + 1}`}
                                className="h-full w-full object-contain"
                              />
                              <span className="absolute left-0.5 top-0.5 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                                {index + 1}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-xs font-medium text-foreground max-w-[140px] sm:max-w-[200px]">
                                  {image.name}
                                </p>
                                {image.isCropped ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400 py-0"
                                  >
                                    {t("scannedAndCropped")}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 text-muted-foreground"
                                  >
                                    {t("originalPhoto")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {t("pageInPdf", { num: index + 1 })}{" "}
                                {image.size ? `· ${formatBytes(image.size)}` : ""}
                              </p>
                            </div>
                          </div>

                          {/* Item Actions */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              id={`btn-crop-page-${index + 1}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isBatchScanning || rotatingId === image.id}
                              onClick={() => setScannerTarget({ image, pageNumber: index + 1 })}
                              className="h-8 gap-1.5 text-xs text-primary hover:text-primary"
                              title={t("scanCropBtn")}
                            >
                              <Crop className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t("scanCropBtn")}</span>
                            </Button>

                            {/* Rotation Controls: Left (90° CCW) and Right (90° CW) */}
                            <div className="flex items-center rounded-md border border-border bg-secondary/30 p-0.5 shadow-2xs">
                              <Button
                                id={`btn-rotate-left-page-${index + 1}`}
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={isBatchScanning || rotatingId === image.id}
                                onClick={() => handleQuickRotate(image.id, -90)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title={t("rotateLeftTitle")}
                                aria-label={`Rotate page ${index + 1} left 90 degrees`}
                              >
                                {rotatingId === image.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                              </Button>

                              <Button
                                id={`btn-rotate-right-page-${index + 1}`}
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={isBatchScanning || rotatingId === image.id}
                                onClick={() => handleQuickRotate(image.id, 90)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title={t("rotateRightTitle")}
                                aria-label={`Rotate page ${index + 1} right 90 degrees`}
                              >
                                {rotatingId === image.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                ) : (
                                  <RotateCw className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>

                            {image.isCropped && (
                              <Button
                                id={`btn-revert-page-${index + 1}`}
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={isBatchScanning || rotatingId === image.id}
                                onClick={() => handleRevertToOriginal(image.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title={t("revertToOriginalTitle")}
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            <Button
                              id={`btn-move-up-page-${index + 1}`}
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveImage(index, "up")}
                              disabled={index === 0 || isBatchScanning || rotatingId === image.id}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title={t("moveUpTitle")}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              id={`btn-move-down-page-${index + 1}`}
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveImage(index, "down")}
                              disabled={
                                index === images.length - 1 ||
                                isBatchScanning ||
                                rotatingId === image.id
                              }
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title={t("moveDownTitle")}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              id={`btn-delete-page-${index + 1}`}
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={isBatchScanning || rotatingId === image.id}
                              onClick={() => removeImage(image.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title={t("deletePhotoTitle")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {notices.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {notices.map((notice: string, i: number) => (
                      <li
                        key={`${notice}-${i}`}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        {notice.includes("applied") || notice.includes("scanned") ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-foreground" />
                        )}
                        <span className="break-all">{notice}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Student & Exam details */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    {t("step2Title")}
                  </CardTitle>
                  {profile && (
                    <Badge variant="outline" className="text-xs text-primary bg-primary/5">
                      {t("profileActive")}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {profile ? t("step2DescSaved") : t("step2DescNew")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Returning User: Saved Profile Banner */}
                {profile ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold shrink-0">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {t("savedStudentProfile")}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({t("savedInBrowser")})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs font-medium border border-border text-foreground">
                            <Building2 className="h-3 w-3 text-primary" />
                            {t("branchLabel")}:{" "}
                            <strong className="text-primary">{profile.branch}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs font-medium border border-border text-foreground">
                            <Hash className="h-3 w-3 text-primary" />
                            {t("enrollNoLabel")}:{" "}
                            <strong className="font-mono text-primary">
                              {profile.enrollmentNumber}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      id="btn-edit-student-details"
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 shrink-0 gap-1.5 bg-background shadow-xs hover:bg-muted"
                      onClick={() => setProfileModalOpen(true)}
                    >
                      <Edit3 className="h-3 w-3" />
                      {t("editDetailsBtn")}
                    </Button>
                  </div>
                ) : (
                  /* First Time User: 1-Time Profile Registration Card */
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          {t("oneTimeSetup")}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {t("savesInBrowser")}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="branch" className="text-xs font-semibold">
                          {t("branchRequired")}
                        </Label>
                        <Input
                          id="branch"
                          value={branchInput}
                          onChange={(e) => {
                            setBranchInput(e.target.value.toUpperCase());
                            if (errors.branch)
                              setErrors((prev) => ({ ...prev, branch: undefined }));
                          }}
                          placeholder={t("branchPlaceholder")}
                          maxLength={20}
                          className="text-xs uppercase"
                          aria-invalid={Boolean(errors.branch)}
                        />
                        {errors.branch && (
                          <p className="text-xs text-destructive">{errors.branch}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="enrollmentNumber" className="text-xs font-semibold">
                          {t("enrollmentRequired")}
                        </Label>
                        <Input
                          id="enrollmentNumber"
                          value={enrollmentInput}
                          onChange={(e) => {
                            setEnrollmentInput(e.target.value);
                            if (errors.enrollmentNumber)
                              setErrors((prev) => ({ ...prev, enrollmentNumber: undefined }));
                          }}
                          placeholder={t("enrollmentPlaceholder")}
                          maxLength={40}
                          className="text-xs font-mono"
                          aria-invalid={Boolean(errors.enrollmentNumber)}
                        />
                        {errors.enrollmentNumber && (
                          <p className="text-xs text-destructive">{errors.enrollmentNumber}</p>
                        )}
                      </div>
                    </div>
                    {branchInput.trim() && enrollmentInput.trim() && (
                      <div className="flex justify-end pt-1">
                        <Button
                          id="btn-save-profile-inline"
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => {
                            const saved = saveStudentProfile({
                              branch: branchInput,
                              enrollmentNumber: enrollmentInput,
                            });
                            handleSaveProfile(saved);
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          {t("saveDetailsFuture")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Creation Fields (Subject & Exam Phase) */}
                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="subject" className="text-xs font-semibold">
                      {t("subjectRequired")}
                    </Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value.toUpperCase())}
                      placeholder={t("subjectPlaceholder")}
                      maxLength={80}
                      aria-invalid={Boolean(errors.subject)}
                      className="text-sm"
                    />
                    {errors.subject ? (
                      <p className="text-xs text-destructive">{errors.subject}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">{t("subjectExample")}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="examPhase" className="text-xs font-semibold">
                      {t("examPhaseRequired")}
                    </Label>
                    <Input
                      id="examPhase"
                      value={examPhase}
                      onChange={(e) => setExamPhase(e.target.value.toUpperCase())}
                      placeholder={t("examPhasePlaceholder")}
                      maxLength={20}
                      aria-invalid={Boolean(errors.examPhase)}
                      className="text-sm"
                    />
                    {errors.examPhase ? (
                      <p className="text-xs text-destructive">{errors.examPhase}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">{t("examPhaseExample")}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Step 3: Preview & Download */}
          <div className="lg:col-span-2">
            <Card className="lg:sticky lg:top-8">
              <CardHeader>
                <CardTitle className="text-lg">{t("step3Title")}</CardTitle>
                {images.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("pagesInFinalPdf", {
                      count: images.length,
                      pageWord: images.length === 1 ? t("pageSingle") : t("pagePlural"),
                    })}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filename Preview */}
                <div className="rounded-lg border border-border/80 bg-secondary/30 p-2.5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {t("targetFilename")}
                  </span>
                  <p className="text-xs font-mono font-semibold text-primary break-all">
                    {`${activeBranch || "BRANCH"}_${activeEnrollmentNumber || "ENROLL"}_${subject.trim() || "SUBJECT"}_${examPhase.trim() || "PHASE"}.pdf`}
                  </p>
                </div>

                {images.length === 0 ? (
                  <p className="rounded-lg bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("emptyPreviewPlaceholder")}
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2.5">
                    {images.map((image, index) => (
                      <li
                        key={image.id}
                        className="group relative cursor-pointer"
                        onClick={() => setScannerTarget({ image, pageNumber: index + 1 })}
                        title={t("scanCropBtn")}
                      >
                        <img
                          src={image.dataUrl}
                          alt={`Assignment page ${index + 1}: ${image.name}`}
                          className="aspect-3/4 w-full rounded-lg border border-border bg-secondary/30 object-contain p-0.5 transition-all group-hover:border-primary group-hover:shadow"
                          loading="lazy"
                        />
                        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground shadow">
                          {index + 1}
                        </span>
                        {image.isCropped && (
                          <span className="absolute right-1 bottom-1 rounded bg-emerald-600/90 px-1 text-[9px] font-bold text-white shadow">
                            {t("scannedBadgeSmall")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Compression Quality Selector */}
                <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        {t("compressionAndQuality")}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {QUALITY_PRESETS[qualityPreset].targetSizeDesc}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {(["standard", "high", "compact"] as const).map((presetKey) => {
                      const isSelected = qualityPreset === presetKey;
                      const presetLabel =
                        presetKey === "standard"
                          ? t("standardPreset")
                          : presetKey === "high"
                            ? t("highPreset")
                            : t("compactPreset");
                      const presetBadge =
                        presetKey === "standard"
                          ? t("standardQualityBadge")
                          : presetKey === "high"
                            ? t("highQualityBadge")
                            : t("compactQualityBadge");
                      return (
                        <button
                          key={presetKey}
                          id={`btn-quality-${presetKey}`}
                          type="button"
                          onClick={() => setQualityPreset(presetKey)}
                          className={`flex flex-col items-center justify-center rounded-lg p-2 text-center transition-all border ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                              : "border-border/60 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="text-xs font-semibold leading-tight flex items-center gap-1">
                            {presetLabel}
                          </span>
                          <span className="text-[10px] opacity-80 mt-0.5 leading-none">
                            {presetBadge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {qualityPreset === "standard"
                      ? t("standardQualityDesc")
                      : qualityPreset === "high"
                        ? t("highQualityDesc")
                        : t("compactQualityDesc")}
                  </p>
                </div>

                {/* Granular PDF Generation Progress Indicator */}
                {isGenerating && (
                  <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-primary min-w-0">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span className="truncate">{getProgressLabel()}</span>
                      </div>
                      <span className="font-mono text-primary font-bold text-xs shrink-0 ml-2">
                        {generationProgress?.percent || 20}%
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/80 border border-border/40">
                      <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(8, generationProgress?.percent || 20)}%` }}
                      />
                    </div>

                    {/* Step breakdown */}
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground pt-0.5">
                      <div
                        className={`text-center font-medium truncate ${
                          generationProgress?.stage === "preparing"
                            ? "text-primary font-bold"
                            : (generationProgress?.percent || 0) >= 20
                              ? "text-foreground"
                              : ""
                        }`}
                      >
                        1. Prepare
                      </div>
                      <div
                        className={`text-center font-medium truncate ${
                          generationProgress?.stage === "processing"
                            ? "text-primary font-bold"
                            : (generationProgress?.percent || 0) >= 70
                              ? "text-foreground"
                              : ""
                        }`}
                      >
                        2. Process
                      </div>
                      <div
                        className={`text-center font-medium truncate ${
                          generationProgress?.stage === "creating"
                            ? "text-primary font-bold"
                            : (generationProgress?.percent || 0) >= 90
                              ? "text-foreground"
                              : ""
                        }`}
                      >
                        3. Build
                      </div>
                      <div
                        className={`text-center font-medium truncate ${
                          generationProgress?.stage === "finalizing"
                            ? "text-primary font-bold"
                            : (generationProgress?.percent || 0) >= 100
                              ? "text-foreground"
                              : ""
                        }`}
                      >
                        4. Finalize
                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Generation Failure with Retry Option (Work and images preserved) */}
                {generationError && !isGenerating && (
                  <div className="space-y-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-destructive animate-in fade-in duration-200">
                    <div className="flex items-start gap-2 text-xs font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="leading-snug">{generationError}</span>
                    </div>
                    <Button
                      id="btn-retry-generate-pdf"
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full text-xs font-semibold shadow-xs cursor-pointer"
                      onClick={handleGenerate}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {t("retryGeneratePdf")}
                    </Button>
                  </div>
                )}

                <Button
                  id="btn-generate-pdf"
                  type="button"
                  className="w-full font-semibold shadow"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {getProgressLabel()}
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" />
                      {t("generateDownloadPdf")}
                    </>
                  )}
                </Button>

                {result && (
                  <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {t("pdfReadyTitle")}
                    </p>
                    <p className="break-all text-xs font-medium text-foreground">
                      {result.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {result.pageCount}{" "}
                        {result.pageCount === 1 ? t("pageSingle") : t("pagePlural")}
                      </span>
                      <span>·</span>
                      <span>
                        {t("fileSize")}:{" "}
                        <strong className="text-foreground">{formatBytes(result.size)}</strong>
                      </span>
                      {result.originalSize && result.originalSize > result.size && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          {t("smallerBadge", {
                            percent: Math.round((1 - result.size / result.originalSize) * 100),
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        id="btn-share-whatsapp"
                        type="button"
                        className="w-full font-semibold shadow bg-[#25D366] hover:bg-[#20bd5a] text-white"
                        onClick={handleShareWhatsApp}
                      >
                        {t("shareWhatsApp")}
                      </Button>
                      <Button
                        id="btn-download-pdf-again"
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-medium border-emerald-600/30 hover:bg-emerald-500/10"
                        onClick={handleManualDownload}
                      >
                        <FileDown className="mr-1.5 h-3.5 w-3.5" />
                        {t("downloadPdfAgain")}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Document Scanner & Crop Modal */}
      {scannerTarget && (
        <DocumentScannerModal
          image={scannerTarget.image}
          pageNumber={scannerTarget.pageNumber}
          isOpen={Boolean(scannerTarget)}
          onClose={() => setScannerTarget(null)}
          onApply={handleApplyScannerCrop}
          onRevertToOriginal={handleRevertToOriginal}
        />
      )}

      {/* Student Profile Registration & Edit Modal */}
      <ProfileEditModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentProfile={profile}
        onSave={handleSaveProfile}
      />

      {/* Feedback Modal */}
      <FeedbackModal isOpen={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} />

      {/* Owner / Admin Feedback Dashboard Modal */}
      <AdminFeedbackModal
        isOpen={adminFeedbackModalOpen}
        onClose={() => setAdminFeedbackModalOpen(false)}
      />
    </main>
  );
}
