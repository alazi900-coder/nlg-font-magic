import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Type, RotateCcw, Search, ChevronDown, ChevronUp,
  MoveHorizontal, ArrowLeftToLine, ArrowRightToLine, Maximize2
} from "lucide-react";
import type { NLGGlyph, NLGHeader } from "@/lib/nlgParser";

interface TextSimulatorProps {
  glyphs: NLGGlyph[];
  pages: HTMLCanvasElement[];
  header: NLGHeader;
  onGlyphUpdate: (index: number, updates: Partial<Pick<NLGGlyph, "widthCol1" | "widthCol2" | "widthCol3">>) => void;
}

// Map standard Arabic codepoints to their presentation form ranges
function getArabicPresentationForms(cp: number): number[] {
  const arabicToPresB: Record<number, number[]> = {
    0x0621: [0xFE80],
    0x0622: [0xFE81, 0xFE82],
    0x0623: [0xFE83, 0xFE84],
    0x0624: [0xFE85, 0xFE86],
    0x0625: [0xFE87, 0xFE88],
    0x0626: [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C],
    0x0627: [0xFE8D, 0xFE8E],
    0x0628: [0xFE8F, 0xFE90, 0xFE91, 0xFE92],
    0x0629: [0xFE93, 0xFE94],
    0x062A: [0xFE95, 0xFE96, 0xFE97, 0xFE98],
    0x062B: [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C],
    0x062C: [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0],
    0x062D: [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4],
    0x062E: [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8],
    0x062F: [0xFEA9, 0xFEAA],
    0x0630: [0xFEAB, 0xFEAC],
    0x0631: [0xFEAD, 0xFEAE],
    0x0632: [0xFEAF, 0xFEB0],
    0x0633: [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4],
    0x0634: [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8],
    0x0635: [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC],
    0x0636: [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0],
    0x0637: [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4],
    0x0638: [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8],
    0x0639: [0xFEC9, 0xFECA, 0xFECB, 0xFECC],
    0x063A: [0xFECD, 0xFECE, 0xFECF, 0xFED0],
    0x0641: [0xFED1, 0xFED2, 0xFED3, 0xFED4],
    0x0642: [0xFED5, 0xFED6, 0xFED7, 0xFED8],
    0x0643: [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC],
    0x0644: [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0],
    0x0645: [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4],
    0x0646: [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8],
    0x0647: [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC],
    0x0648: [0xFEED, 0xFEEE],
    0x0649: [0xFEEF, 0xFEF0],
    0x064A: [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4],
  };
  return arabicToPresB[cp] || [];
}

interface GlyphPosition {
  glyphIdx: number;
  x: number;
  width: number;
  char: string;
}

const TextSimulator = ({ glyphs, pages, header, onGlyphUpdate }: TextSimulatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testText, setTestText] = useState("مرحبا بالعالم 123");
  const [selectedGlyphIndex, setSelectedGlyphIndex] = useState<number | null>(null);
  const [glyphSearch, setGlyphSearch] = useState("");
  const [showGlyphBrowser, setShowGlyphBrowser] = useState(false);
  const glyphPositionsRef = useRef<GlyphPosition[]>([]);

  // Build a map from codePoint to glyph index
  const glyphMap = useMemo(() => {
    const map = new Map<number, number>();
    glyphs.forEach((g, i) => {
      map.set(g.codePoint, i);
    });
    return map;
  }, [glyphs]);

  // Find glyph index for a codepoint, checking presentation forms too
  const findGlyphIndex = useCallback((cp: number): number | undefined => {
    let idx = glyphMap.get(cp);
    if (idx !== undefined) return idx;
    const forms = getArabicPresentationForms(cp);
    for (const form of forms) {
      idx = glyphMap.get(form);
      if (idx !== undefined) return idx;
    }
    return undefined;
  }, [glyphMap]);

  // Render the test text on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pages.length) return;

    const ctx = canvas.getContext("2d")!;
    const scale = 3;
    const canvasWidth = canvas.clientWidth;
    const renderHeight = header.renderHeight;
    const padding = 24;
    const canvasH = renderHeight * scale + padding * 2;
    const cssHeight = Math.max(canvasH / (scale / 2), 100);

    canvas.width = canvasWidth * 2;
    canvas.height = canvasH;
    canvas.style.height = `${cssHeight}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
    ctx.fill();

    // Baseline guide
    ctx.strokeStyle = "rgba(139, 92, 246, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const baselineY = padding + header.ascent * scale;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(canvas.width, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    const chars = [...testText];
    // For RTL, start from the right side
    let currentX = canvas.width - padding * scale;
    const baseY = padding;
    const positions: GlyphPosition[] = [];

    for (const char of chars) {
      const cp = char.codePointAt(0) ?? 0;
      const glyphIdx = findGlyphIndex(cp);

      if (glyphIdx === undefined) {
        const spaceWidth = 10 * scale;
        currentX -= spaceWidth;
        positions.push({ glyphIdx: -1, x: currentX, width: spaceWidth, char });
        continue;
      }

      const g = glyphs[glyphIdx];
      const cellW = g.x2 - g.x1;
      const cellH = g.y2 - g.y1;
      const totalAdvance = g.widthCol1 + g.widthCol2 + g.widthCol3;

      currentX -= totalAdvance * scale;
      positions.push({ glyphIdx, x: currentX, width: totalAdvance * scale, char });

      if (cellW > 0 && cellH > 0 && pages[g.page]) {
        const drawX = currentX + g.widthCol1 * scale;
        ctx.drawImage(
          pages[g.page],
          g.x1, g.y1, cellW, cellH,
          drawX, baseY, cellW * scale, cellH * scale
        );
      }

      // Highlight selected glyph
      if (selectedGlyphIndex === glyphIdx) {
        // Background highlight
        ctx.fillStyle = "rgba(139, 92, 246, 0.08)";
        ctx.fillRect(currentX - 2, 0, totalAdvance * scale + 4, canvas.height);

        // Border
        ctx.strokeStyle = "hsl(262, 83%, 58%)";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.roundRect(currentX - 2, baseY - 4, totalAdvance * scale + 4, renderHeight * scale + 8, 6);
        ctx.stroke();

        // Glow
        ctx.shadowColor = "hsl(262, 83%, 58%)";
        ctx.shadowBlur = 12;
        ctx.strokeRect(currentX - 2, baseY - 4, totalAdvance * scale + 4, renderHeight * scale + 8);
        ctx.shadowBlur = 0;

        // Width zones
        const col1End = currentX + g.widthCol1 * scale;
        const col2End = col1End + g.widthCol2 * scale;

        if (g.widthCol1 > 0) {
          ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
          ctx.fillRect(currentX, baseY - 4, g.widthCol1 * scale, renderHeight * scale + 8);
        }

        ctx.fillStyle = "rgba(34, 211, 238, 0.18)";
        ctx.fillRect(col1End, baseY - 4, g.widthCol2 * scale, renderHeight * scale + 8);

        if (g.widthCol3 > 0) {
          ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
          ctx.fillRect(col2End, baseY - 4, g.widthCol3 * scale, renderHeight * scale + 8);
        }

        // Dividers
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        [col1End, col2End].forEach(x => {
          ctx.beginPath();
          ctx.moveTo(x, baseY - 4);
          ctx.lineTo(x, baseY + renderHeight * scale + 4);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // Labels under zones
        ctx.font = `${9 * (scale / 2)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
        if (g.widthCol1 > 0) ctx.fillText(`${g.widthCol1}`, currentX + g.widthCol1 * scale / 2, baseY + renderHeight * scale + 18);
        ctx.fillStyle = "rgba(34, 211, 238, 0.9)";
        ctx.fillText(`${g.widthCol2}`, col1End + g.widthCol2 * scale / 2, baseY + renderHeight * scale + 18);
        ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
        if (g.widthCol3 > 0) ctx.fillText(`${g.widthCol3}`, col2End + g.widthCol3 * scale / 2, baseY + renderHeight * scale + 18);
      }
    }

    glyphPositionsRef.current = positions;
  }, [testText, glyphs, pages, header, findGlyphIndex, selectedGlyphIndex]);

  // Handle canvas click/touch to select glyph
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? (e as any).changedTouches?.[0]?.clientX ?? 0;
    } else {
      clientX = e.clientX;
    }
    
    const x = (clientX - rect.left) * scale;
    
    for (const pos of glyphPositionsRef.current) {
      if (x >= pos.x && x <= pos.x + pos.width && pos.glyphIdx >= 0) {
        setSelectedGlyphIndex(prev => prev === pos.glyphIdx ? null : pos.glyphIdx);
        return;
      }
    }
  }, []);

  const selectedGlyph = selectedGlyphIndex !== null ? glyphs[selectedGlyphIndex] : null;

  // Filtered glyph list for browser
  const filteredGlyphs = useMemo(() => {
    if (!glyphSearch) return glyphs.slice(0, 80);
    const s = glyphSearch.toLowerCase();
    return glyphs.filter(g => {
      const char = g.codePoint > 31 ? String.fromCodePoint(g.codePoint) : "";
      const hex = g.codePoint.toString(16).toUpperCase();
      return char.includes(s) || hex.toLowerCase().includes(s) || g.codePoint.toString().includes(s) || g.charOrUnicode.includes(s);
    }).slice(0, 80);
  }, [glyphs, glyphSearch]);

  // Character buttons from the test text for quick selection
  const textChars = useMemo(() => {
    const chars = [...testText];
    return chars.map((char, i) => {
      const cp = char.codePointAt(0) ?? 0;
      const glyphIdx = findGlyphIndex(cp);
      return { char, cp, glyphIdx: glyphIdx ?? -1, index: i };
    });
  }, [testText, findGlyphIndex]);

  const handleReset = (field: "widthCol1" | "widthCol2" | "widthCol3") => {
    if (selectedGlyphIndex === null) return;
    const g = glyphs[selectedGlyphIndex];
    if (!g.rawLine) return;
    const match = g.rawLine.match(/Width\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
    if (!match) return;
    const origValues = { widthCol1: parseInt(match[1]), widthCol2: parseInt(match[2]), widthCol3: parseInt(match[3]) };
    onGlyphUpdate(selectedGlyphIndex, { [field]: origValues[field] });
  };

  const handleResetAll = () => {
    if (selectedGlyphIndex === null) return;
    const g = glyphs[selectedGlyphIndex];
    if (!g.rawLine) return;
    const match = g.rawLine.match(/Width\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
    if (!match) return;
    onGlyphUpdate(selectedGlyphIndex, {
      widthCol1: parseInt(match[1]),
      widthCol2: parseInt(match[2]),
      widthCol3: parseInt(match[3]),
    });
  };

  return (
    <div className="space-y-3">
      {/* Main Simulator */}
      <Card className="glass-card overflow-hidden border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg gradient-primary">
              <Type className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>محاكي نص اللعبة</span>
            <Badge variant="secondary" className="text-[10px] mr-auto">تفاعلي</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Text input */}
          <Input
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="اكتب جملة تجريبية..."
            className="text-base h-11 bg-secondary/50 border-border/50 focus:border-primary/50"
            dir="auto"
          />

          {/* Canvas with touch support */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl border border-border/30 cursor-pointer touch-manipulation"
              onClick={handleCanvasClick}
              onTouchEnd={handleCanvasClick}
            />
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              اضغط على أي حرف لتعديله
            </p>
          </div>

          {/* Quick character buttons */}
          <div className="flex flex-wrap gap-1.5">
            {textChars.map((c, i) => {
              const isSpace = c.char === ' ';
              const isFound = c.glyphIdx >= 0;
              const isSelected = selectedGlyphIndex === c.glyphIdx && c.glyphIdx >= 0;
              
              if (isSpace) return <div key={i} className="w-3" />;
              
              return (
                <button
                  key={i}
                  onClick={() => isFound ? setSelectedGlyphIndex(isSelected ? null : c.glyphIdx) : undefined}
                  disabled={!isFound}
                  className={`
                    min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium
                    transition-all duration-200 border
                    ${isSelected
                      ? 'gradient-primary text-primary-foreground border-primary shadow-lg scale-110'
                      : isFound
                        ? 'bg-secondary/80 hover:bg-secondary border-border/50 hover:border-primary/40 hover:scale-105 active:scale-95'
                        : 'bg-muted/30 border-border/20 text-muted-foreground/50 cursor-not-allowed'
                    }
                  `}
                >
                  {c.char}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Glyph Editor - appears when a glyph is selected */}
      {selectedGlyph && selectedGlyphIndex !== null && (
        <Card className="glass-card border-primary/30 overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl gradient-primary text-xl font-mono text-primary-foreground shadow-lg">
                  {selectedGlyph.codePoint > 31 ? String.fromCodePoint(selectedGlyph.codePoint) : "·"}
                </div>
                <div>
                  <Badge className="font-mono text-[10px] gradient-primary border-0">
                    U+{selectedGlyph.codePoint.toString(16).toUpperCase().padStart(4, "0")}
                  </Badge>
                  <div className="flex items-center gap-2 mt-1">
                    <MoveHorizontal className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      إجمالي: <span className="font-mono font-bold text-foreground">{selectedGlyph.widthCol1 + selectedGlyph.widthCol2 + selectedGlyph.widthCol3}</span>px
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2" onClick={handleResetAll}>
                  <RotateCcw className="h-3 w-3" />
                  إعادة
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedGlyphIndex(null)}>
                  ✕
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <EditorField
              label="إزاحة يسار"
              icon={<ArrowRightToLine className="h-3.5 w-3.5" />}
              value={selectedGlyph.widthCol1}
              onChange={(v) => onGlyphUpdate(selectedGlyphIndex, { widthCol1: v })}
              onReset={() => handleReset("widthCol1")}
              min={-20} max={50}
              colorClass="bg-primary/20 text-primary"
            />
            <EditorField
              label="عرض الحرف"
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              value={selectedGlyph.widthCol2}
              onChange={(v) => onGlyphUpdate(selectedGlyphIndex, { widthCol2: v })}
              onReset={() => handleReset("widthCol2")}
              min={0} max={80}
              colorClass="bg-accent/20 text-accent"
            />
            <EditorField
              label="إزاحة يمين"
              icon={<ArrowLeftToLine className="h-3.5 w-3.5" />}
              value={selectedGlyph.widthCol3}
              onChange={(v) => onGlyphUpdate(selectedGlyphIndex, { widthCol3: v })}
              onReset={() => handleReset("widthCol3")}
              min={-20} max={50}
              colorClass="bg-primary/20 text-primary"
            />

            {/* Visual width bar */}
            <div className="bg-secondary/30 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground text-center mb-1.5">توزيع العرض</p>
              <div className="flex items-center gap-px h-7 rounded-lg overflow-hidden">
                {selectedGlyph.widthCol1 > 0 && (
                  <div
                    className="h-full bg-primary/30 flex items-center justify-center text-[9px] text-primary font-mono font-bold rounded-r"
                    style={{ flex: selectedGlyph.widthCol1 }}
                  >{selectedGlyph.widthCol1}</div>
                )}
                <div
                  className="h-full bg-accent/40 flex items-center justify-center text-[9px] text-accent-foreground font-mono font-bold"
                  style={{ flex: Math.max(selectedGlyph.widthCol2, 1) }}
                >{selectedGlyph.widthCol2}</div>
                {selectedGlyph.widthCol3 > 0 && (
                  <div
                    className="h-full bg-primary/30 flex items-center justify-center text-[9px] text-primary font-mono font-bold rounded-l"
                    style={{ flex: selectedGlyph.widthCol3 }}
                  >{selectedGlyph.widthCol3}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Glyph Browser */}
      <Card className="glass-card overflow-hidden">
        <CardHeader
          className="pb-2 cursor-pointer select-none"
          onClick={() => setShowGlyphBrowser(!showGlyphBrowser)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/10">
                <Search className="h-4 w-4 text-accent" />
              </div>
              <span>متصفح الأحرف</span>
              <Badge variant="secondary" className="text-[10px]">{glyphs.length}</Badge>
            </div>
            {showGlyphBrowser ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {showGlyphBrowser && (
          <CardContent className="space-y-3 pt-0">
            <Input
              value={glyphSearch}
              onChange={(e) => setGlyphSearch(e.target.value)}
              placeholder="ابحث بالحرف أو الكود (مثال: م أو 0645)..."
              className="bg-secondary/50 border-border/50 h-9 text-sm"
              dir="auto"
            />
            <div className="grid grid-cols-7 sm:grid-cols-10 gap-1 max-h-52 overflow-y-auto p-0.5">
              {filteredGlyphs.map((g) => {
                const glyphIdx = glyphs.indexOf(g);
                const char = g.codePoint > 31 ? String.fromCodePoint(g.codePoint) : "·";
                const isSelected = selectedGlyphIndex === glyphIdx;
                return (
                  <button
                    key={glyphIdx}
                    onClick={() => setSelectedGlyphIndex(isSelected ? null : glyphIdx)}
                    className={`
                      flex flex-col items-center justify-center p-1 rounded-lg text-xs
                      transition-all duration-150 border
                      ${isSelected
                        ? 'gradient-primary text-primary-foreground border-primary scale-110 shadow-md'
                        : 'bg-secondary/40 hover:bg-secondary border-border/20 hover:border-primary/30 active:scale-95'
                      }
                    `}
                    title={`U+${g.codePoint.toString(16).toUpperCase().padStart(4, "0")}`}
                  >
                    <span className="text-sm leading-tight">{char}</span>
                    <span className={`text-[7px] leading-tight font-mono ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                      {g.codePoint.toString(16).toUpperCase().padStart(4, "0")}
                    </span>
                  </button>
                );
              })}
            </div>
            {filteredGlyphs.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-3">لا نتائج</p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

function EditorField({ label, icon, value, onChange, onReset, min, max, colorClass }: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
  min: number;
  max: number;
  colorClass: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${colorClass}`}>
            {icon}
          </div>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            className="w-14 h-7 text-xs text-center font-mono bg-secondary/50 border-border/50"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={onReset} title="إعادة للأصل">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
      />
    </div>
  );
}

export default TextSimulator;
