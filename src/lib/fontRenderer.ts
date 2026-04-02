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
  const fontSize = header.fontSize;

  // Determine total pages needed from original data
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
  const scale = fontSize / font.unitsPerEm;

  for (const orig of originalGlyphs) {
    const { codePoint, page, x1, y1, x2, y2 } = orig;
    const charStr = String.fromCodePoint(codePoint);
    const cellHeight = y2 - y1;

    // Get context for original page
    const ctx = pages[page].getContext("2d")!;

    // Calculate baseline: position within the cell
    // Use ascent ratio relative to cell height
    const baseline = y1 + Math.round(cellHeight * (header.ascent / header.height));

    // Measure advance width from new font
    const glyph = font.charToGlyph(charStr);
    const advanceWidth = glyph && glyph.index !== 0
      ? Math.ceil((glyph.advanceWidth ?? font.unitsPerEm) * scale)
      : orig.widthCol2;

    // Draw glyph at original position
    try {
      const path = font.getPath(charStr, x1, baseline, fontSize);
      path.fill = `rgb(${header.colorR}, ${header.colorG}, ${header.colorB})`;
      path.draw(ctx);
    } catch {
      ctx.fillStyle = `rgb(${header.colorR}, ${header.colorG}, ${header.colorB})`;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(charStr, x1, baseline);
    }

    // Keep original coordinates, only update widthCol2
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
