import { enhanceImageData } from "./image-enhancement";

export type StudentDetails = {
  branch: string;
  enrollmentNumber: string;
  subject: string;
  examPhase: string;
};

export type PdfQualityPreset = "high" | "standard" | "compact";

export interface QualityPresetConfig {
  id: PdfQualityPreset;
  label: string;
  badge?: string;
  description: string;
  targetSizeDesc: string;
  maxDimension: number;
  jpegQuality: number;
}

export const QUALITY_PRESETS: Record<PdfQualityPreset, QualityPresetConfig> = {
  standard: {
    id: "standard",
    label: "Standard",
    badge: "Recommended",
    description: "Great balance of crisp text and manageable file size",
    targetSizeDesc: "~400–700 KB/page",
    maxDimension: 1800,
    jpegQuality: 0.82,
  },
  high: {
    id: "high",
    label: "High Quality",
    description: "Maximum resolution & sharp details for complex diagrams",
    targetSizeDesc: "~1.2–2.5 MB/page",
    maxDimension: 2400,
    jpegQuality: 0.92,
  },
  compact: {
    id: "compact",
    label: "Small File",
    description: "Strong compression for email or tight portal upload limits",
    targetSizeDesc: "~150–350 KB/page",
    maxDimension: 1200,
    jpegQuality: 0.65,
  },
};

export type UploadedImage = {
  id: string;
  name: string;
  dataUrl: string;
  originalDataUrl: string;
  size?: number;
  isCropped?: boolean;
  currentQuad?: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  confidence?: number;
};

const sanitize = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "Unknown";

export const buildFileName = (d: StudentDetails) =>
  `${sanitize(d.branch)}_${sanitize(d.enrollmentNumber)}_${sanitize(d.subject)}_${sanitize(d.examPhase)}.pdf`;

/**
 * Standard A4 document dimensions in PostScript points (1 pt = 1/72 inch).
 * A4 size: 210mm x 297mm = 595.28 pt x 841.89 pt.
 */
export const A4_PORTRAIT_WIDTH = 595.28;
export const A4_PORTRAIT_HEIGHT = 841.89;

const decodeImage = async (
  dataUrl: string,
  pageIndex: number,
  imageName?: string,
): Promise<{
  naturalWidth: number;
  naturalHeight: number;
  draw: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    w: number,
    h: number,
  ) => void;
  cleanup: () => void;
}> => {
  if (typeof createImageBitmap === "function") {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      return {
        naturalWidth: bitmap.width,
        naturalHeight: bitmap.height,
        draw: (ctx, w, h) => {
          ctx.drawImage(bitmap, 0, 0, w, h);
        },
        cleanup: () => {
          try {
            bitmap.close();
          } catch {
            // ignore
          }
        },
      };
    } catch {
      // Fall through to standard Image element
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        naturalWidth: img.naturalWidth || img.width,
        naturalHeight: img.naturalHeight || img.height,
        draw: (ctx, w, h) => {
          ctx.drawImage(img, 0, 0, w, h);
        },
        cleanup: () => {
          img.onload = null;
          img.onerror = null;
          img.src = "";
        },
      });
    };
    img.onerror = () =>
      reject(
        new Error(
          `Page ${pageIndex + 1} (${imageName || "Image"}) could not be read or decoded. Please verify the image file.`,
        ),
      );
    img.src = dataUrl;
  });
};

/**
 * Concurrently maps an array with a worker limit to optimize throughput
 * while preventing main-thread lockup and memory exhaustion.
 * Preserves strict input order in the returned array.
 */
async function pMap<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  onItemCompleted?: (completedCount: number, total: number) => void,
): Promise<R[]> {
  const total = items.length;
  const results = new Array<R>(total);
  let currentIndex = 0;
  let completedCount = 0;

  const poolSize = Math.min(concurrency, total);
  const workers = Array.from({ length: poolSize }, async () => {
    while (true) {
      const idx = currentIndex++;
      if (idx >= total) break;
      const item = items[idx]!;
      const res = await mapper(item, idx);
      results[idx] = res;
      completedCount++;
      onItemCompleted?.(completedCount, total);
      // Brief micro-yield to keep UI frame rate smooth
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Optimizes an uploaded assignment image based on user-selected quality:
 * - Scales resolution based on selected compression preset while strictly preserving aspect ratio
 * - Cleanses heavy camera metadata bloat
 * - Preserves handwriting and diagrams
 * - Zero white margins or padding
 */
const optimizeImageForPdf = async (
  image: UploadedImage,
  index: number,
  enableSmartFilter = true,
  qualityPreset: PdfQualityPreset = "standard",
) => {
  const decoded = await decodeImage(image.dataUrl, index, image.name);
  try {
    const rawWidth = decoded.naturalWidth;
    const rawHeight = decoded.naturalHeight;

    if (!rawWidth || !rawHeight || rawWidth <= 0 || rawHeight <= 0) {
      throw new Error(`Page ${index + 1} (${image.name || "Image"}) has invalid dimensions.`);
    }

    const preset = QUALITY_PRESETS[qualityPreset] || QUALITY_PRESETS.standard;
    const maxSide = Math.max(rawWidth, rawHeight);
    const scale = maxSide > preset.maxDimension ? preset.maxDimension / maxSide : 1;

    const targetWidth = Math.max(1, Math.round(rawWidth * scale));
    const targetHeight = Math.max(1, Math.round(rawHeight * scale));

    // Prefer OffscreenCanvas for non-blocking canvas rendering if supported
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const offCanvas = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = offCanvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          decoded.draw(ctx, targetWidth, targetHeight);

          if (enableSmartFilter) {
            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            enhanceImageData(imgData);
            ctx.putImageData(imgData, 0, 0);
          }

          const blob = await offCanvas.convertToBlob({
            type: "image/jpeg",
            quality: preset.jpegQuality,
          });

          const dataUrl = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });

          return {
            dataUrl,
            width: targetWidth,
            height: targetHeight,
          };
        }
      } catch {
        // Fall back to standard DOM canvas
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error(`Page ${index + 1}: Canvas graphics context is unavailable.`);
    }

    // Use high quality image smoothing to prevent jagged handwriting when downscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Fill pure white background to support transparent PNGs and preserve paper margins
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Draw image precisely across canvas without any cropping, stretching, or padding
    decoded.draw(ctx, targetWidth, targetHeight);

    // Apply smart automatic document enhancement only if enabled (ON)
    if (enableSmartFilter) {
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      enhanceImageData(imgData);
      ctx.putImageData(imgData, 0, 0);
    }

    // Convert to JPEG with selected compression quality
    const optimizedDataUrl = canvas.toDataURL("image/jpeg", preset.jpegQuality);

    // Release canvas dimensions to assist garbage collection
    canvas.width = 1;
    canvas.height = 1;

    return {
      dataUrl: optimizedDataUrl,
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    decoded.cleanup();
  }
};

export type PdfProgressStage = "preparing" | "processing" | "creating" | "finalizing" | "ready";

export interface PdfGenerationProgress {
  stage: PdfProgressStage;
  percent: number;
  current?: number;
  total?: number;
}

export type ProgressCallback = (progress: PdfGenerationProgress) => void;

export async function generateAssignmentPdf(
  details: StudentDetails,
  images: UploadedImage[],
  enableSmartFilter = false,
  qualityPreset: PdfQualityPreset = "compact",
  onProgress?: ProgressCallback,
): Promise<{ blob: Blob; fileName: string }> {
  const validImages = images.filter((img) => Boolean(img?.dataUrl));
  if (validImages.length === 0) {
    throw new Error("No images provided to generate PDF. Please upload at least one page.");
  }

  // 1. Preparing images & PDF engine (approx. 20%)
  onProgress?.({
    stage: "preparing",
    percent: 20,
    total: validImages.length,
  });
  // Yield to main thread for non-blocking UI update
  await new Promise((resolve) => setTimeout(resolve, 30));

  const { jsPDF } = await import("jspdf");

  // 2. Process and optimize images concurrently in batches (20% -> 70%)
  const total = validImages.length;
  const concurrency =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? Math.max(2, Math.min(4, navigator.hardwareConcurrency))
      : 3;

  onProgress?.({
    stage: "processing",
    percent: 20,
    current: 0,
    total,
  });

  const optimizedImages = await pMap(
    validImages,
    concurrency,
    async (item, idx) => {
      try {
        return await optimizeImageForPdf(item, idx, enableSmartFilter, qualityPreset);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Page ${idx + 1} failed to process.`;
        throw new Error(msg);
      }
    },
    (completedCount) => {
      const currentPercent = Math.min(70, Math.round(20 + (completedCount / total) * 50));
      onProgress?.({
        stage: "processing",
        percent: currentPercent,
        current: completedCount,
        total,
      });
    },
  );

  // 3. Creating PDF document pages (70% -> 90%)
  onProgress?.({
    stage: "creating",
    percent: 75,
    current: 1,
    total,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const first = optimizedImages[0]!;
  const firstOrientation = first.width > first.height ? "landscape" : "portrait";

  // Initialize PDF with page dimensions tailored strictly to the first image dimensions and aspect ratio
  const doc = new jsPDF({
    unit: "pt",
    format: [first.width, first.height],
    orientation: firstOrientation,
    compress: true,
  });

  // Render the first image filling the entire page without any margins, padding, or letterboxing
  doc.addImage(first.dataUrl, "JPEG", 0, 0, first.width, first.height, undefined, "FAST");

  // Render subsequent pages, each custom-fitted to its exact image dimensions and aspect ratio
  for (let i = 1; i < optimizedImages.length; i++) {
    const { dataUrl, width, height } = optimizedImages[i]!;
    const orientation = width > height ? "landscape" : "portrait";

    doc.addPage([width, height], orientation);
    doc.addImage(dataUrl, "JPEG", 0, 0, width, height, undefined, "FAST");

    const pagePercent = Math.min(90, Math.round(75 + ((i + 1) / total) * 15));
    onProgress?.({
      stage: "creating",
      percent: pagePercent,
      current: i + 1,
      total,
    });

    // Small yield every 3 pages
    if (i % 3 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // 4. Compressing and Finalizing (90% -> 98%)
  onProgress?.({
    stage: "finalizing",
    percent: 95,
  });
  await new Promise((resolve) => setTimeout(resolve, 25));

  const blob = doc.output("blob");

  // 5. Ready (100%)
  onProgress?.({
    stage: "ready",
    percent: 100,
  });

  return { blob, fileName: buildFileName(details) };
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
