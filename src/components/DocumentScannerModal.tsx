import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  Check,
  Crop,
  Eye,
  Loader2,
  Maximize2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type Corner,
  type Quad,
  detectDocument,
  warpQuad,
  rotateImage,
  rotateQuad,
  FULL_QUAD,
  dist,
} from "@/lib/page-scan";
import type { UploadedImage } from "@/lib/assignment-pdf";

type DocumentScannerModalProps = {
  image: UploadedImage | null;
  pageNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onApply: (updated: {
    id: string;
    dataUrl: string;
    isCropped: boolean;
    currentQuad: Quad;
    confidence?: number;
  }) => void;
  onRevertToOriginal: (id: string) => void;
};

const CORNER_NAMES = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"] as const;
const CORNER_ABBR = ["TL", "TR", "BR", "BL"] as const;

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = (props) => {
  if (!props.isOpen || !props.image) return null;
  return <ScannerModalDialog {...props} image={props.image} />;
};

const ScannerModalDialog: React.FC<DocumentScannerModalProps & { image: UploadedImage }> = ({
  image,
  pageNumber,
  onClose,
  onApply,
  onRevertToOriginal,
}) => {
  // Active working image dataUrl (may be rotated during edit session)
  const [workingDataUrl, setWorkingDataUrl] = useState<string>(
    image.originalDataUrl || image.dataUrl,
  );
  const [corners, setCorners] = useState<Quad>(image.currentQuad || FULL_QUAD());
  const [initialCorners, setInitialCorners] = useState<Quad>(image.currentQuad || FULL_QUAD());
  const [confidence, setConfidence] = useState<number | null>(image.confidence ?? null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isWarping, setIsWarping] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [previewWarpUrl, setPreviewWarpUrl] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({
    width: 800,
    height: 1000,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load natural dimensions & run initial detection if corners not set
  useEffect(() => {
    let isMounted = true;
    const initDataUrl = image.originalDataUrl || image.dataUrl;
    setWorkingDataUrl(initDataUrl);

    const img = new Image();
    img.onload = async () => {
      if (!isMounted) return;
      setImageDims({ width: img.naturalWidth || 800, height: img.naturalHeight || 1000 });

      if (image.currentQuad) {
        setCorners(image.currentQuad);
        setInitialCorners(image.currentQuad);
        setConfidence(image.confidence ?? 0.9);
      } else {
        // Run auto-detect for physical paper sheet
        setIsDetecting(true);
        try {
          const res = await detectDocument(initDataUrl);
          if (isMounted) {
            setCorners(res.quad);
            setInitialCorners(res.quad);
            setConfidence(res.confidence);
          }
        } catch {
          if (isMounted) {
            const fallback = FULL_QUAD();
            setCorners(fallback);
            setInitialCorners(fallback);
            setConfidence(0);
          }
        } finally {
          if (isMounted) setIsDetecting(false);
        }
      }
    };
    img.src = initDataUrl;

    return () => {
      isMounted = false;
    };
  }, [image]);

  // Generate live perspective preview when switching to preview tab
  useEffect(() => {
    if (activeTab === "preview") {
      let isMounted = true;
      setIsWarping(true);
      // Fast preview warp at 1000px max dimension for instant responsiveness
      warpQuad(workingDataUrl, corners, 1000)
        .then((res) => {
          if (isMounted) {
            setPreviewWarpUrl(res.dataUrl);
            setIsWarping(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsWarping(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab, workingDataUrl, corners]);

  const runAutoDetect = async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    try {
      const res = await detectDocument(workingDataUrl);
      setCorners(res.quad);
      setConfidence(res.confidence);
    } catch {
      setCorners(FULL_QUAD());
      setConfidence(0);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRotate = async (degrees: 90 | -90) => {
    setIsDetecting(true);
    try {
      const rotatedUrl = await rotateImage(workingDataUrl, degrees);
      setWorkingDataUrl(rotatedUrl);
      setCorners((prev) => rotateQuad(prev, degrees));
      setInitialCorners((prev) => rotateQuad(prev, degrees));
      setImageDims((prev) => ({ width: prev.height, height: prev.width }));
    } finally {
      setIsDetecting(false);
    }
  };

  const handleResetCorners = () => {
    setCorners(initialCorners);
  };

  const handleSetFullPage = () => {
    setCorners(FULL_QUAD());
  };

  const handleUseOriginal = () => {
    onRevertToOriginal(image.id);
    onClose();
  };

  const handleApplyCrop = async () => {
    setIsWarping(true);
    try {
      const warped = await warpQuad(workingDataUrl, corners, 2400);
      onApply({
        id: image.id,
        dataUrl: warped.dataUrl,
        isCropped: true,
        currentQuad: corners,
        confidence: confidence ?? 1,
      });
      onClose();
    } catch {
      // If warp fails, fallback
      onApply({
        id: image.id,
        dataUrl: workingDataUrl,
        isCropped: true,
        currentQuad: corners,
        confidence: confidence ?? 0.8,
      });
      onClose();
    } finally {
      setIsWarping(false);
    }
  };

  // Pointer drag event handlers for corners
  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingIndex(index);
    updateCornerPos(index, e.clientX, e.clientY);
  };

  const updateCornerPos = useCallback((index: number, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;

    // Edge snapping: if dragged within 2.5% of outer borders, snap to extreme edge (0 or 1)
    if (x < 0.025) x = 0;
    else if (x > 0.975) x = 1;
    else x = Math.max(0, Math.min(1, x));

    if (y < 0.025) y = 0;
    else if (y > 0.975) y = 1;
    else y = Math.max(0, Math.min(1, y));

    setDragPos({ x: clientX - rect.left, y: clientY - rect.top });
    setCorners((prev) => {
      const next = [...prev] as Quad;
      next[index] = { x, y };
      return next;
    });
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIndex === null) return;
    updateCornerPos(draggingIndex, e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIndex !== null) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      setDraggingIndex(null);
      setDragPos(null);
    }
  };

  const isLowConfidence = confidence !== null && confidence < 0.42;

  // Compute SVG polygon coordinates (0 to 100%)
  const pTL = { x: corners[0].x * 100, y: corners[0].y * 100 };
  const pTR = { x: corners[1].x * 100, y: corners[1].y * 100 };
  const pBR = { x: corners[2].x * 100, y: corners[2].y * 100 };
  const pBL = { x: corners[3].x * 100, y: corners[3].y * 100 };

  // SVG path cutout: outer rectangle covering 100x100, then subpath for quad
  const cutoutPath = `M 0 0 H 100 V 100 H 0 Z M ${pTL.x} ${pTL.y} L ${pTR.x} ${pTR.y} L ${pBR.x} ${pBR.y} L ${pBL.x} ${pBL.y} Z`;

  return (
    <div
      id="document-scanner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4 md:p-6"
    >
      <div className="flex h-full max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/40 bg-card text-card-foreground shadow-2xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-secondary/30 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Crop className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold sm:text-lg">
                  Document Scanner & Crop — Page {pageNumber}
                </h2>
                {image.isCropped && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    Cropped
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Detects outer physical paper edges. All blank areas and page margins are preserved.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch: Edit vs Preview */}
            <div className="flex rounded-lg border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "edit"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Crop className="h-3.5 w-3.5" />
                Adjust Corners
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "preview"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Straightened Preview
              </button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Close scanner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Low confidence info banner */}
        {isLowConfidence && !isDetecting && activeTab === "edit" && (
          <div className="flex items-center gap-2.5 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300 sm:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              Outer paper boundary was ambiguous, so the full page is preserved. You can drag corner
              handles to crop desk background or keep full frame.
            </p>
          </div>
        )}

        {/* Main interactive canvas / preview area */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-950/90 p-3 sm:p-5">
          {isDetecting && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm font-medium text-white">
                Detecting physical paper boundary...
              </p>
            </div>
          )}

          {activeTab === "edit" ? (
            <div
              ref={containerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="relative select-none"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                aspectRatio: `${imageDims.width} / ${imageDims.height}`,
                touchAction: "none",
              }}
            >
              {/* Background source image */}
              <img
                ref={imageRef}
                src={workingDataUrl}
                alt="Scanner source"
                className="pointer-events-none h-full w-full rounded-md object-contain shadow-lg"
                draggable={false}
              />

              {/* Shaded SVG overlay with quad cutout and boundary stroke */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {/* Darkened backdrop for trimmed background */}
                <path d={cutoutPath} fill="rgba(0, 0, 0, 0.48)" fillRule="evenodd" />

                {/* Bright polygon bounding stroke */}
                <polygon
                  points={`${pTL.x},${pTL.y} ${pTR.x},${pTR.y} ${pBR.x},${pBR.y} ${pBL.x},${pBL.y}`}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth="0.8"
                  strokeDasharray="2 1"
                  className="transition-all duration-75"
                />
              </svg>

              {/* 4 Interactive Corner Handles */}
              {corners.map((c, i) => {
                const isDragging = draggingIndex === i;
                return (
                  <div
                    key={CORNER_NAMES[i]}
                    id={`corner-handle-${CORNER_ABBR[i].toLowerCase()}`}
                    onPointerDown={(e) => handlePointerDown(i, e)}
                    style={{
                      left: `${c.x * 100}%`,
                      top: `${c.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      touchAction: "none",
                    }}
                    className={`group absolute z-20 flex h-11 w-11 cursor-grab items-center justify-center active:cursor-grabbing ${
                      isDragging ? "z-30 scale-110" : ""
                    }`}
                  >
                    {/* Visual inner circle */}
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform ${
                        isDragging
                          ? "bg-emerald-500 ring-4 ring-emerald-400/40"
                          : "bg-emerald-600 hover:scale-110 hover:bg-emerald-500"
                      }`}
                    >
                      <span className="text-[9px] font-bold text-white leading-none">
                        {CORNER_ABBR[i]}
                      </span>
                    </div>

                    {/* Corner tooltip tag */}
                    <div
                      className={`pointer-events-none absolute -top-6 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wider whitespace-nowrap shadow opacity-0 transition-opacity group-hover:opacity-100 ${
                        isDragging ? "opacity-100" : ""
                      }`}
                    >
                      {CORNER_NAMES[i]}
                    </div>
                  </div>
                );
              })}

              {/* Magnifier Loupe when dragging on touch/pointer */}
              {draggingIndex !== null && dragPos && (
                <div
                  className="pointer-events-none absolute z-40 h-28 w-28 overflow-hidden rounded-full border-2 border-white bg-black shadow-2xl ring-4 ring-emerald-500/50"
                  style={{
                    left: `${dragPos.x}px`,
                    top: `${dragPos.y - 75}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    src={workingDataUrl}
                    alt="Zoom loupe"
                    className="absolute"
                    style={{
                      width: `${imageDims.width}px`,
                      height: `${imageDims.height}px`,
                      maxWidth: "none",
                      maxHeight: "none",
                      left: `-${corners[draggingIndex]!.x * imageDims.width - 56}px`,
                      top: `-${corners[draggingIndex]!.y * imageDims.height - 56}px`,
                      transformOrigin: "0 0",
                    }}
                  />
                  {/* Crosshair target */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full border border-emerald-400 bg-emerald-400/30" />
                    <div className="absolute h-full w-[1px] bg-emerald-400/40" />
                    <div className="absolute h-[1px] w-full bg-emerald-400/40" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Perspective Straightened Preview */
            <div className="flex h-full w-full items-center justify-center">
              {isWarping ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-xs font-medium">Applying perspective warp...</p>
                </div>
              ) : previewWarpUrl ? (
                <div className="flex max-h-full max-w-full flex-col items-center justify-center">
                  <img
                    src={previewWarpUrl}
                    alt="Straightened document scan"
                    className="max-h-[68vh] max-w-full rounded-md border border-border/50 object-contain shadow-2xl"
                  />
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    Perspective corrected & straightened
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Could not generate preview.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer Controls Toolbar */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-secondary/20 p-3 sm:px-6">
          {/* Left tools: Auto Crop, Whole Page, Rotate, Reset */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              id="btn-scanner-autocrop"
              variant="outline"
              size="sm"
              onClick={runAutoDetect}
              disabled={isDetecting || activeTab === "preview"}
              className="gap-1.5 text-xs"
              title="Detect outer physical paper edges"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Auto Detect Page
            </Button>

            <Button
              id="btn-scanner-fullpage"
              variant="outline"
              size="sm"
              onClick={handleSetFullPage}
              disabled={isDetecting || activeTab === "preview"}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Set crop corners to full image frame"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full Frame
            </Button>

            <div className="flex items-center rounded-md border border-border bg-background p-0.5 shadow-2xs">
              <Button
                id="btn-scanner-rotate-left"
                variant="ghost"
                size="sm"
                onClick={() => handleRotate(-90)}
                disabled={isDetecting || isWarping}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Rotate Left 90° (Counter-Clockwise)"
                aria-label="Rotate document left 90 degrees"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">Rotate Left</span>
              </Button>

              <Button
                id="btn-scanner-rotate-right"
                variant="ghost"
                size="sm"
                onClick={() => handleRotate(90)}
                disabled={isDetecting || isWarping}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Rotate Right 90° (Clockwise)"
                aria-label="Rotate document right 90 degrees"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">Rotate Right</span>
              </Button>
            </div>

            <Button
              id="btn-scanner-reset"
              variant="ghost"
              size="sm"
              onClick={handleResetCorners}
              disabled={isDetecting || activeTab === "preview"}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>

          {/* Right actions: Revert to original, Cancel, Apply Crop */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              id="btn-scanner-use-original"
              variant="ghost"
              size="sm"
              onClick={handleUseOriginal}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              No Crop / Use Original
            </Button>

            <Button
              id="btn-scanner-apply"
              onClick={handleApplyCrop}
              disabled={isWarping || isDetecting}
              size="sm"
              className="gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground shadow"
            >
              {isWarping ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Apply Scan
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
