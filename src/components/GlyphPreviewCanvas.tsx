import { useRef, useCallback } from "react";
import type { NLGGlyph } from "@/lib/nlgParser";

interface GlyphPreviewCanvasProps {
  imageUrl: string;
  glyphs: NLGGlyph[];
  pageIndex: number;
  selectedGlyph: NLGGlyph | null;
  onGlyphClick: (glyph: NLGGlyph | null) => void;
}

const GlyphPreviewCanvas = ({
  imageUrl,
  glyphs,
  pageIndex,
  selectedGlyph,
  onGlyphClick,
}: GlyphPreviewCanvasProps) => {
  const imgRef = useRef<HTMLImageElement>(null);

  const pageGlyphs = glyphs.filter((g) => g.page === pageIndex);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const img = imgRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      // Scale from display coordinates to actual image coordinates
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Find which glyph was clicked
      const found = pageGlyphs.find(
        (g) => clickX >= g.x1 && clickX <= g.x2 && clickY >= g.y1 && clickY <= g.y2
      );

      onGlyphClick(found ?? null);
    },
    [pageGlyphs, onGlyphClick]
  );

  // Calculate overlay position for selected glyph
  const getOverlayStyle = (glyph: NLGGlyph): React.CSSProperties | null => {
    const img = imgRef.current;
    if (!img || glyph.page !== pageIndex) return null;

    const rect = img.getBoundingClientRect();
    const scaleX = rect.width / img.naturalWidth;
    const scaleY = rect.height / img.naturalHeight;

    return {
      position: "absolute",
      left: `${glyph.x1 * scaleX}px`,
      top: `${glyph.y1 * scaleY}px`,
      width: `${(glyph.x2 - glyph.x1) * scaleX}px`,
      height: `${(glyph.y2 - glyph.y1) * scaleY}px`,
      border: "2px solid hsl(var(--primary))",
      backgroundColor: "hsl(var(--primary) / 0.15)",
      borderRadius: "2px",
      pointerEvents: "none" as const,
    };
  };

  return (
    <div
      className="relative cursor-crosshair inline-block"
      onClick={handleClick}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt={`صفحة ${pageIndex + 1}`}
        className="max-w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {selectedGlyph && selectedGlyph.page === pageIndex && (
        <div style={getOverlayStyle(selectedGlyph)!} />
      )}
    </div>
  );
};

export default GlyphPreviewCanvas;
