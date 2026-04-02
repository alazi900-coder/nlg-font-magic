import opentype from "opentype.js";
import type { NLGHeader, NLGGlyph } from "./nlgParser";

export interface RenderedResult {
  pages: HTMLCanvasElement[];
  glyphs: NLGGlyph[];
  header: NLGHeader;
}

export async function renderFont(
  fontBuffer: ArrayBuffer,
  header: NLGHeader,
  originalGlyphs: NLGGlyph[]
): Promise<RenderedResult> {
  const font = opentype.parse(fontBuffer);
  const pageSize = header.pageSize;
  const baseFontSize = header.fontSize; // 18
  const baseRenderHeight = header.renderHeight; // 28
  const baseAscent = header.ascent; // 24

  // Determine total pages from original data
  const maxPage = originalGlyphs.reduce((max, g) => Math.max(max, g.page), 0);
  const totalPages = maxPage + 1;

  // Create all pages upfront
  const pages: HTMLCanvasElement[] = [];
  for (let i = 0; i < totalPages; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = pageSize;
    canvas.height = pageSize;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, pageSize, pageSize);
    pages.push(canvas);
  }

  const updatedGlyphs: NLGGlyph[] = [];

  for (const orig of originalGlyphs) {
    const { codePoint, page, x1, y1, x2, y2 } = orig;
    const charStr = String.fromCodePoint(codePoint);
    const cellHeight = y2 - y1;
    const cellWidth = x2 - x1;

    if (cellHeight <= 0 || cellWidth <= 0) {
      // Zero-size glyph (like space), keep as-is
      updatedGlyphs.push({ ...orig, rawLine: "" });
      continue;
    }

    const ctx = pages[page].getContext("2d")!;

    // Scale fontSize proportionally to cell height
    // Original: fontSize 18 produces renderHeight 28
    // For cell of height 112: scaledFontSize = 18 * (112 / 28) = 72
    const scale = cellHeight / baseRenderHeight;
    const scaledFontSize = baseFontSize * scale;
    const scaledAscent = baseAscent * scale;

    // Baseline position within the cell
    const baseline = y1 + scaledAscent;

    // Measure advance width with scaled font
    const glyph = font.charToGlyph(charStr);
    const fontScale = scaledFontSize / font.unitsPerEm;
    const advanceWidth = glyph && glyph.index !== 0
      ? Math.ceil((glyph.advanceWidth ?? font.unitsPerEm) * fontScale)
      : orig.widthCol2;

    // Draw glyph at original position with scaled size
    try {
      const path = font.getPath(charStr, x1, baseline, scaledFontSize);
      path.fill = `rgb(${header.colorR}, ${header.colorG}, ${header.colorB})`;
      path.draw(ctx);
    } catch {
      ctx.fillStyle = `rgb(${header.colorR}, ${header.colorG}, ${header.colorB})`;
      ctx.font = `${scaledFontSize}px sans-serif`;
      ctx.fillText(charStr, x1, baseline);
    }

    // Keep original coordinates, update widthCol2
    updatedGlyphs.push({
      ...orig,
      widthCol2: advanceWidth,
      rawLine: "",
    });
  }

  return {
    pages,
    glyphs: updatedGlyphs,
    header: { ...header, pageCount: totalPages },
  };
}

export function canvasesToBlob(pages: HTMLCanvasElement[]): Promise<Blob[]> {
  return Promise.all(
    pages.map(
      (canvas) =>
        new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), "image/png");
        })
    )
  );
}
