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

const loadImage = (dataUrl: string, pageIndex: number, imageName?: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          `Page ${pageIndex + 1} (${imageName || "Image"}) could not be read or decoded. Please verify the image file.`,
        ),
      );
    img.src = dataUrl;
  });

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
  const img = await loadImage(image.dataUrl, index, image.name);
  const rawWidth = img.naturalWidth || img.width;
  const rawHeight = img.naturalHeight || img.height;

  if (!rawWidth || !rawHeight || rawWidth <= 0 || rawHeight <= 0) {
    throw new Error(`Page ${index + 1} (${image.name || "Image"}) has invalid dimensions.`);
  }

  const preset = QUALITY_PRESETS[qualityPreset] || QUALITY_PRESETS.standard;
  const maxSide = Math.max(rawWidth, rawHeight);
  const scale = maxSide > preset.maxDimension ? preset.maxDimension / maxSide : 1;

  const targetWidth = Math.max(1, Math.round(rawWidth * scale));
  const targetHeight = Math.max(1, Math.round(rawHeight * scale));

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
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

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
};

export async function generateAssignmentPdf(
  details: StudentDetails,
  images: UploadedImage[],
  enableSmartFilter = true,
  qualityPreset: PdfQualityPreset = "standard",
): Promise<{ blob: Blob; fileName: string }> {
  const validImages = images.filter((img) => Boolean(img?.dataUrl));
  if (validImages.length === 0) {
    throw new Error("No images provided to generate PDF. Please upload at least one page.");
  }

  const { jsPDF } = await import("jspdf");

  // Optimize and compress each image based on chosen quality settings
  const optimizedImages: { dataUrl: string; width: number; height: number }[] = [];
  for (let i = 0; i < validImages.length; i++) {
    try {
      const optimized = await optimizeImageForPdf(
        validImages[i]!,
        i,
        enableSmartFilter,
        qualityPreset,
      );
      optimizedImages.push(optimized);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Page ${i + 1} failed to process.`;
      throw new Error(msg);
    }
  }

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
  }

  return { blob: doc.output("blob"), fileName: buildFileName(details) };
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
