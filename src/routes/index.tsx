import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Crop,
  Edit3,
  FileDown,
  GraduationCap,
  Hash,
  ImagePlus,
  Loader2,
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
} from "@/lib/assignment-pdf";
import { detectDocument, rotateImage, rotateQuad, warpQuad, type Quad } from "@/lib/page-scan";
import { DocumentScannerModal } from "@/components/DocumentScannerModal";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { getSavedProfile, saveStudentProfile } from "@/lib/profile";
import { StudentProfile } from "@/types";

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
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [branchInput, setBranchInput] = useState("");
  const [enrollmentInput, setEnrollmentInput] = useState("");
  const [subject, setSubject] = useState("");
  const [examPhase, setExamPhase] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [smartFilterEnabled, setSmartFilterEnabled] = useState(true);
  const [qualityPreset, setQualityPreset] = useState<PdfQualityPreset>("standard");
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [scannerTarget, setScannerTarget] = useState<{
    image: UploadedImage;
    pageNumber: number;
  } | null>(null);

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
      `Saved details: Branch ${newProfile.branch} · Enrollment No ${newProfile.enrollmentNumber}`,
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
    const accepted = Array.from(files).filter((f) =>
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type),
    );
    if (accepted.length === 0) return;

    // Instantly create object URLs so all selected images appear in the preview immediately (0ms delay)
    const newImages: UploadedImage[] = accepted.map((file) => {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

    // Display immediately without blocking or waiting for heavy base64 conversion / canvas scanning
    setImages((prev) => [...prev, ...newImages]);
    setErrors(({ images: _omit, ...rest }) => rest);
    setResult(null);

    if (inputRef.current) inputRef.current.value = "";
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
      const pageLabel = pageIdx >= 0 ? `Page ${pageIdx + 1}` : "Page";
      notify(`${pageLabel} rotated ${degrees === 90 ? "right (90°)" : "left (90°)"}`);
    } catch {
      notify("Failed to rotate page.");
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
    notify("Reverted to original photo.");
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
    notify("Page crop and perspective correction applied!");
  };

  // Batch auto-crop all uncropped images with high confidence
  const handleBatchAutoCrop = async () => {
    if (images.length === 0 || isBatchScanning) return;
    setIsBatchScanning(true);
    let successCount = 0;

    try {
      const updatedImages = [...images];
      const total = updatedImages.length;

      // Process in small parallel chunks of 2 for fast off-thread execution while maintaining responsiveness
      const chunkSize = 2;
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = updatedImages.slice(i, i + chunkSize);
        setBatchProgress(
          `Scanning pages ${i + 1}–${Math.min(i + chunkSize, total)} of ${total}...`,
        );

        await Promise.all(
          chunk.map(async (item, chunkOffset) => {
            const idx = i + chunkOffset;
            try {
              const detection = await detectDocument(item.originalDataUrl);
              if (detection.isConfident && detection.confidence >= 0.65) {
                const warped = await warpQuad(item.originalDataUrl, detection.quad, 2200);
                updatedImages[idx] = {
                  ...item,
                  dataUrl: warped.dataUrl,
                  isCropped: true,
                  currentQuad: detection.quad,
                  confidence: detection.confidence,
                };
                successCount++;
              }
            } catch {
              // Skip if detection fails
            }
          }),
        );

        // Yield to browser rendering loop between chunks
        await new Promise((r) => setTimeout(r, 16));
      }

      setImages(updatedImages);
      notify(`Auto-scanned ${successCount} of ${images.length} pages.`);
    } finally {
      setIsBatchScanning(false);
      setBatchProgress("");
    }
  };

  const activeBranch = profile ? profile.branch : branchInput.trim().toUpperCase();
  const activeEnrollmentNumber = profile ? profile.enrollmentNumber : enrollmentInput.trim();

  const validate = () => {
    const next: Errors = {};
    if (!activeBranch) next.branch = "Branch is required (e.g. CE)";
    if (!activeEnrollmentNumber)
      next.enrollmentNumber = "Enrollment number is required (e.g. 25002170110091)";
    if (!subject.trim()) next.subject = "Subject is required (e.g. DS)";
    if (!examPhase.trim()) next.examPhase = "Exam phase is required (e.g. T1)";
    if (images.length === 0) next.images = "Upload at least one assignment photo";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleGenerate = async () => {
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
      notify("Assignment PDF created successfully!");
    } catch (err: unknown) {
      console.error("PDF Generation error:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to generate PDF. Please verify your images.";
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
    notify("PDF downloaded! Opening WhatsApp so you can select a chat and send your assignment.");
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
              Student toolkit
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Assignment PDF Maker
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Upload assignment photos, auto-detect document borders, perspective crop, and download
              a submission-ready PDF.
            </p>
          </div>

          {/* Student Profile Quick Status / Edit */}
          <div className="shrink-0 flex items-center">
            {profile ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card p-2 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="text-left pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">Saved Profile</span>
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
                  title="Edit Branch & Enrollment Number"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
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
                <span>Save Student Profile</span>
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {/* Step 1: Upload photos */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3">
                <CardTitle className="text-lg">1. Upload assignment photos</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Smart Filter ON/OFF Toggle */}
                  <div
                    id="toggle-smart-filter-container"
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs"
                    title="Automatically enhances text contrast, exposure, and clarity"
                  >
                    <Wand2 className="h-3.5 w-3.5 text-primary" />
                    <Label
                      htmlFor="switch-smart-filter"
                      className="cursor-pointer text-xs font-semibold select-none flex items-center gap-1.5"
                    >
                      <span>Smart Filter</span>
                      <Badge
                        variant={smartFilterEnabled ? "default" : "secondary"}
                        className="text-[9px] px-1 py-0 h-4 font-bold uppercase tracking-wider"
                      >
                        {smartFilterEnabled ? "ON" : "OFF"}
                      </Badge>
                    </Label>
                    <Switch
                      id="switch-smart-filter"
                      checked={smartFilterEnabled}
                      onCheckedChange={(checked) => setSmartFilterEnabled(checked)}
                      aria-label="Toggle Smart Document Filter"
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
                          {batchProgress || "Scanning..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          Auto-Crop All
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
                    Tap to add JPG or PNG photos
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    You can select multiple pages at once
                  </span>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Uploaded Pages ({images.length}) — Ordered 1 to {images.length}
                    </p>
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
                                    Scanned &amp; Cropped
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 text-muted-foreground"
                                  >
                                    Original Photo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Page {index + 1} in PDF{" "}
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
                              title="Scan and adjust 4 corners"
                            >
                              <Crop className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Scan / Crop</span>
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
                                title="Rotate Left 90° (Counter-Clockwise)"
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
                                title="Rotate Right 90° (Clockwise)"
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
                                title="Revert to Original"
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
                              title="Move Up"
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
                              title="Move Down"
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
                              title="Delete photo"
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
                    2. Submission details
                  </CardTitle>
                  {profile && (
                    <Badge variant="outline" className="text-xs text-primary bg-primary/5">
                      Profile Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {profile
                    ? "Your Branch and Enrollment Number are saved on this browser. Just enter the Subject and Exam Phase."
                    : "Enter your Branch and Enrollment Number once. They will be saved on this browser for future assignments."}
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
                            Saved Student Profile
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            (Saved in browser)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs font-medium border border-border text-foreground">
                            <Building2 className="h-3 w-3 text-primary" />
                            Branch: <strong className="text-primary">{profile.branch}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs font-medium border border-border text-foreground">
                            <Hash className="h-3 w-3 text-primary" />
                            Enroll No:{" "}
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
                      Edit Details
                    </Button>
                  </div>
                ) : (
                  /* First Time User: 1-Time Profile Registration Card */
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          1-Time Student Profile Setup
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Saves in your browser
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="branch" className="text-xs font-semibold">
                          Branch *
                        </Label>
                        <Input
                          id="branch"
                          value={branchInput}
                          onChange={(e) => {
                            setBranchInput(e.target.value.toUpperCase());
                            if (errors.branch)
                              setErrors((prev) => ({ ...prev, branch: undefined }));
                          }}
                          placeholder="e.g. CE, IT, ME"
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
                          Enrollment Number *
                        </Label>
                        <Input
                          id="enrollmentNumber"
                          value={enrollmentInput}
                          onChange={(e) => {
                            setEnrollmentInput(e.target.value);
                            if (errors.enrollmentNumber)
                              setErrors((prev) => ({ ...prev, enrollmentNumber: undefined }));
                          }}
                          placeholder="e.g. 25002170110091"
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
                          Save Details for Future
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Creation Fields (Subject & Exam Phase) */}
                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="subject" className="text-xs font-semibold">
                      Subject *
                    </Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value.toUpperCase())}
                      placeholder="e.g. DS"
                      maxLength={80}
                      aria-invalid={Boolean(errors.subject)}
                      className="text-sm"
                    />
                    {errors.subject ? (
                      <p className="text-xs text-destructive">{errors.subject}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Example: DS, Java-2, TOC, DCN
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="examPhase" className="text-xs font-semibold">
                      Exam Phase *
                    </Label>
                    <Input
                      id="examPhase"
                      value={examPhase}
                      onChange={(e) => setExamPhase(e.target.value.toUpperCase())}
                      placeholder="e.g. T1"
                      maxLength={20}
                      aria-invalid={Boolean(errors.examPhase)}
                      className="text-sm"
                    />
                    {errors.examPhase ? (
                      <p className="text-xs text-destructive">{errors.examPhase}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Example: T1, T2, T3, Assignment-1
                      </p>
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
                <CardTitle className="text-lg">3. Preview &amp; download</CardTitle>
                {images.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {images.length} {images.length === 1 ? "page" : "pages"} will be in the final
                    PDF
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filename Preview */}
                <div className="rounded-lg border border-border/80 bg-secondary/30 p-2.5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Target Filename:
                  </span>
                  <p className="text-xs font-mono font-semibold text-primary break-all">
                    {`${activeBranch || "BRANCH"}_${activeEnrollmentNumber || "ENROLL"}_${subject.trim() || "SUBJECT"}_${examPhase.trim() || "PHASE"}.pdf`}
                  </p>
                </div>

                {images.length === 0 ? (
                  <p className="rounded-lg bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground">
                    Your uploaded pages will appear here.
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2.5">
                    {images.map((image, index) => (
                      <li
                        key={image.id}
                        className="group relative cursor-pointer"
                        onClick={() => setScannerTarget({ image, pageNumber: index + 1 })}
                        title="Click to open Document Scanner"
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
                            Scanned
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
                        Compression &amp; Quality
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {QUALITY_PRESETS[qualityPreset].targetSizeDesc}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {(["standard", "high", "compact"] as const).map((presetKey) => {
                      const preset = QUALITY_PRESETS[presetKey];
                      const isSelected = qualityPreset === presetKey;
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
                            {preset.label}
                          </span>
                          <span className="text-[10px] opacity-80 mt-0.5 leading-none">
                            {presetKey === "standard"
                              ? "Balanced"
                              : presetKey === "high"
                                ? "Crispest"
                                : "Smallest"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {QUALITY_PRESETS[qualityPreset].description}
                  </p>
                </div>

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
                      Generating PDF…
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" />
                      Generate &amp; download PDF
                    </>
                  )}
                </Button>

                {result && (
                  <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Your PDF is ready!
                    </p>
                    <p className="break-all text-xs font-medium text-foreground">
                      {result.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {result.pageCount} {result.pageCount === 1 ? "page" : "pages"}
                      </span>
                      <span>·</span>
                      <span>
                        File size:{" "}
                        <strong className="text-foreground">{formatBytes(result.size)}</strong>
                      </span>
                      {result.originalSize && result.originalSize > result.size && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          {Math.round((1 - result.size / result.originalSize) * 100)}% smaller
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
                        📤 Share with WhatsApp
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
                        Download PDF
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
    </main>
  );
}
