import opentype from "opentype.js";
import type { NLGHeader, NLGGlyph } from "./nlgParser";

export interface RenderedResult {
  /** Array of canvas elements, one per page */
  pages: HTMLCanvasElement[];
  /** Updated glyphs with new coordinates */
  glyphs: NLGGlyph[];
  /** Updated header (pageCount may change) */
  header: NLGHeader;
}

export async function renderFont(
  fontBuffer: ArrayBuffer,
  header: NLGHeader,
  originalGlyphs: NLGGlyph[]
): Promise<RenderedResult> {
  const font = opentype.parse(fontBuffer);
  const pageSize = header.pageSize; // 1024
  const rowHeight = header.renderHeight; // 28
  const fontSize = header.fontSize; // 18
  const padding = 2;

  // We'll pack glyphs row by row across pages
  const pages: HTMLCanvasElement[] = [];
  const updatedGlyphs: NLGGlyph[] = [];

  let currentPage = 0;
  let cursorX = 0;
  let cursorY = 0;

  function getOrCreatePage(pageIndex: number): CanvasRenderingContext2D {
    while (pages.length <= pageIndex) {
      const canvas = document.createElement("canvas");
      canvas.width = pageSize;
      canvas.height = pageSize;
      const ctx = canvas.getContext("2d")!;
      // Transparent background
      ctx.clearRect(0, 0, pageSize, pageSize);
      pages.push(canvas);
    }
    return pages[pageIndex].getContext("2d")!;
  }

  // Measure helper
  function measureGlyph(codePoint: number): { width: number; advanceWidth: number } {
    const glyph = font.charToGlyph(String.fromCodePoint(codePoint));
    if (!glyph || glyph.index === 0) {
      return { width: fontSize, advanceWidth: fontSize };
    }
    const scale = fontSize / font.unitsPerEm;
    const advance = (glyph.advanceWidth ?? font.unitsPerEm) * scale;
    const bbox = glyph.getBoundingBox();
    const w = (bbox.x2 - bbox.x1) * scale;
    return { width: Math.max(Math.ceil(w), 1), advanceWidth: Math.ceil(advance) };
  }

  for (const origGlyph of originalGlyphs) {
    const { codePoint, charOrUnicode, widthCol1 } = origGlyph;
    const charStr = String.fromCodePoint(codePoint);

    const measured = measureGlyph(codePoint);
    // Total glyph cell width including some padding
    const cellWidth = Math.max(measured.advanceWidth + padding * 2, 4);
    const cellHeight = rowHeight;

    // Check if we need to wrap to next row or page
    if (cursorX + cellWidth > pageSize) {
      cursorX = 0;
      cursorY += cellHeight;
    }
    if (cursorY + cellHeight > pageSize) {
      currentPage++;
      cursorX = 0;
      cursorY = 0;
    }

    const ctx = getOrCreatePage(currentPage);

    // Draw the glyph
    const x = cursorX + padding;
    const baseline = cursorY + header.ascent;

    try {
      const path = font.getPath(charStr, x, baseline, fontSize);
      path.fill = `rgb(${header.colorR}, ${header.colorG}, ${header.colorB})`;
      path.draw(ctx);
    } catch {
      // Fallback: use canvas text rendering
      ctx.fillStyle = `rgb(${header.colorR}, ${header.colorG}, ${header.colorB})`;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(charStr, x, baseline);
    }

    // Record new coordinates
    const newGlyph: NLGGlyph = {
      charOrUnicode,
      codePoint,
      widthCol1,
      widthCol2: measured.advanceWidth,
      widthCol3: origGlyph.widthCol3,
      x1: cursorX,
      y1: cursorY,
      x2: cursorX + cellWidth,
      y2: cursorY + cellHeight,
      page: currentPage,
      rawLine: "",
    };
    updatedGlyphs.push(newGlyph);

    cursorX += cellWidth;
  }

  const updatedHeader: NLGHeader = {
    ...header,
    pageCount: pages.length,
  };

  return { pages, glyphs: updatedGlyphs, header: updatedHeader };
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
