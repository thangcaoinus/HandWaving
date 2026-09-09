import jsPDF from "jspdf";
import { drawLine } from "./draw";
import { ensureTextRastersReady, peekTextImage } from "./textRasterCache";
import { ensureImagesReady, peekImage } from "./imageCache";

// Fixed high supersample bucket for print-quality exported math/text.
const EXPORT_ZOOM_BUCKET = 2;

function drawStroke(ctx, points, config) {
  if (!points || points.length === 0) return;
  
  for (let i = 0; i < points.length - 1; i++) {
    drawLine(points[i], points[i + 1], ctx, config, 1);
  }
}

function calculateFullBoundingBox(strokes) {
  if (!strokes || strokes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  strokes.forEach((stroke) => {
    if (stroke.bbox) {
      minX = Math.min(minX, stroke.bbox.minX);
      minY = Math.min(minY, stroke.bbox.minY);
      maxX = Math.max(maxX, stroke.bbox.maxX);
      maxY = Math.max(maxY, stroke.bbox.maxY);
    } else if (Array.isArray(stroke.points)) {
      stroke.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    }
  });

  // Add 10% padding
  const padding = Math.max((maxX - minX) * 0.1, (maxY - minY) * 0.1, 50);
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

async function createFullCanvas(strokes) {
  const bbox = calculateFullBoundingBox(strokes);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = bbox.width;
  tempCanvas.height = bbox.height;

  const ctx = tempCanvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, bbox.width, bbox.height);

  ctx.translate(-bbox.minX, -bbox.minY);

  // Text is rendered Markdown/KaTeX — warm its rasters (and wait for KaTeX fonts) so
  // we can drawImage them instead of fillText. This also fixes the old single-fillText
  // bug that silently dropped every line after the first.
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* non-fatal */ }
  }
  await ensureTextRastersReady(strokes, EXPORT_ZOOM_BUCKET);
  await ensureImagesReady(strokes); // decode image objects so drawImage below has them ready

  strokes.forEach((stroke) => {
    if (stroke.type === 'text') {
      const color = (stroke.config && stroke.config.color) || '#000000';
      const raster = peekTextImage(stroke.text, stroke.fontSize, color, EXPORT_ZOOM_BUCKET);
      if (raster && raster.image) {
        // Match the on-canvas origin: (x,y) is the first-line anchor, block at y-fontSize.
        ctx.drawImage(raster.image, stroke.x, stroke.y - stroke.fontSize, raster.w, raster.h);
      }
    } else if (stroke.type === 'image') {
      const img = peekImage(stroke.src);
      if (img && img.image) {
        // Image origin is its own top-left (no fontSize offset).
        ctx.drawImage(img.image, stroke.x, stroke.y, stroke.width, stroke.height);
      }
    } else {
      // Render regular stroke
      drawStroke(ctx, stroke.points, stroke.config);
    }
  });

  return tempCanvas;
}

export async function exportToPNG(strokes, filename = "canvas.png") {
  if (!strokes || strokes.length === 0) {
    console.warn("No strokes to export");
    return;
  }

  try {
    const canvas = await createFullCanvas(strokes);

    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("Failed to create blob from canvas");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch (error) {
    console.error("Error exporting to PNG:", error);
  }
}

export async function exportToPDF(strokes, filename = "canvas.pdf", options = {}) {
  if (!strokes || strokes.length === 0) {
    console.warn("No strokes to export");
    return;
  }

  try {
    const canvas = await createFullCanvas(strokes);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const aspectRatio = canvasWidth / canvasHeight;

    const orientation =
      options.orientation || (aspectRatio > 1 ? "landscape" : "portrait");
    const format = options.format || "a4";

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    let imgWidth = pdfWidth;
    let imgHeight = canvasHeight * (pdfWidth / canvasWidth);

    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight;
      imgWidth = canvasWidth * (pdfHeight / canvasHeight);
    }

    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;

    const imgData = canvas.toDataURL("image/png");

    pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
  }
}

export function exportToJSON(strokes, viewport, filename = "canvas.json") {
  try {
    const data = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      viewport: {
        zoom: viewport.zoom,
        pan: viewport.pan,
      },
      strokes: strokes.map((stroke) => {
        if (stroke.type === 'text') {
          // Export text object
          return {
            id: stroke.id,
            type: 'text',
            text: stroke.text,
            x: stroke.x,
            y: stroke.y,
            fontSize: stroke.fontSize,
            config: stroke.config,
            attachedTo: stroke.attachedTo,
            bbox: stroke.bbox,
          };
        } else if (stroke.type === 'image') {
          // Export image object (src is a self-contained data URI)
          return {
            id: stroke.id,
            type: 'image',
            src: stroke.src,
            x: stroke.x,
            y: stroke.y,
            width: stroke.width,
            height: stroke.height,
            config: stroke.config,
            attachedTo: stroke.attachedTo,
            bbox: stroke.bbox,
          };
        } else {
          // Export regular stroke
          return {
            id: stroke.id,
            points: stroke.points,
            config: stroke.config,
            shape: stroke.shape,
            bbox: stroke.bbox,
          };
        }
      }),
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting to JSON:", error);
  }
}
