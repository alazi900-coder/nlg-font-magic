import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Type, RotateCcw, Search, ChevronDown, ChevronUp } from "lucide-react";
import type { NLGGlyph, NLGHeader } from "@/lib/nlgParser";

interface TextSimulatorProps {
  glyphs: NLGGlyph[];
  pages: HTMLCanvasElement[];
  header: NLGHeader;
  onGlyphUpdate: (index: number, updates: Partial<Pick<NLGGlyph, "widthCol1" | "widthCol2" | "widthCol3">>) => void;
}

// Map standard Arabic codepoints to their presentation form ranges
function getArabicPresentationForms(cp: number): number[] {
  // Standard Arabic → Presentation Forms B mapping (common forms)
  const arabicToPresB: Record<number, number[]> = {
    0x0621: [0xFE80], // hamza
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

const TextSimulator = ({ glyphs, pages, header, onGlyphUpdate }: TextSimulatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testText, setTestText] = useState("مرحبا بالعالم 123");
  const [selectedGlyphIndex, setSelectedGlyphIndex] = useState<number | null>(null);
  const [glyphSearch, setGlyphSearch] = useState("");
  const [showGlyphBrowser, setShowGlyphBrowser] = useState(false);

  // Build a map from codePoint to glyph index (including presentation forms)
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
    // Try Arabic presentation forms
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
    const scale = 2;
    const canvasWidth = canvas.clientWidth;
    const renderHeight = header.renderHeight;
    const padding = 20;
    const canvasH = renderHeight * scale + padding * 2;

    canvas.width = canvasWidth * scale;
    canvas.height = canvasH;
    canvas.style.height = `${canvasH / scale}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, "rgba(15, 10, 30, 0.95)");
    grad.addColorStop(1, "rgba(25, 15, 45, 0.95)");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
    ctx.fill();

    const chars = [...testText];
    let currentX = padding * scale;
    const baseY = padding;

    for (const char of chars) {
      const cp = char.codePointAt(0) ?? 0;
      const glyphIdx = findGlyphIndex(cp);

      if (glyphIdx === undefined) {
        currentX += 10 * scale;
        continue;
      }

      const g = glyphs[glyphIdx];
      const cellW = g.x2 - g.x1;
      const cellH = g.y2 - g.y1;
      const totalAdvance = g.widthCol1 + g.widthCol2 + g.widthCol3;

      if (cellW > 0 && cellH > 0 && pages[g.page]) {
        const drawX = currentX + g.widthCol1 * scale;
        ctx.drawImage(
          pages[g.page],
          g.x1, g.y1, cellW, cellH,
          drawX, baseY * scale, cellW * scale, cellH * scale
        );
      }

      // Highlight if this glyph is selected
      if (selectedGlyphIndex === glyphIdx) {
        ctx.strokeStyle = "hsl(250, 85%, 65%)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(currentX, baseY * scale - 2, totalAdvance * scale, renderHeight * scale + 4);
        ctx.setLineDash([]);
      }

      currentX += totalAdvance * scale;
    }
  }, [testText, glyphs, pages, header, findGlyphIndex, selectedGlyphIndex]);

  const selectedGlyph = selectedGlyphIndex !== null ? glyphs[selectedGlyphIndex] : null;

  // Filtered glyph list for browser
  const filteredGlyphs = useMemo(() => {
    if (!glyphSearch) return glyphs.slice(0, 60);
    const s = glyphSearch.toLowerCase();
    return glyphs.filter(g => {
      const char = g.codePoint > 31 ? String.fromCodePoint(g.codePoint) : "";
      const hex = g.codePoint.toString(16).toUpperCase();
      return char.includes(s) || hex.toLowerCase().includes(s) || g.codePoint.toString().includes(s) || g.charOrUnicode.includes(s);
    }).slice(0, 60);
  }, [glyphs, glyphSearch]);

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
    <div className="space-y-4">
      {/* Simulator Card */}
      <Card className="glass-card card-hover overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-1.5 rounded-lg gradient-primary">
              <Type className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>محاكي نص اللعبة</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="اكتب جملة تجريبية..."
            className="text-lg h-12 bg-secondary/50 border-border/50 focus:border-primary/50"
            dir="ltr"
          />
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl border border-border/30"
          />
        </CardContent>
      </Card>

      {/* Glyph Browser Card */}
      <Card className="glass-card card-hover overflow-hidden">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowGlyphBrowser(!showGlyphBrowser)}>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg gradient-accent">
                <Search className="h-4 w-4 text-accent-foreground" />
              </div>
              <span>متصفح الأحرف</span>
              <Badge variant="secondary" className="text-xs">{glyphs.length}</Badge>
            </div>
            {showGlyphBrowser ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showGlyphBrowser && (
          <CardContent className="space-y-3">
            <Input
              value={glyphSearch}
              onChange={(e) => setGlyphSearch(e.target.value)}
              placeholder="ابحث بالحرف أو الكود (مثال: م أو 0645)..."
              className="bg-secondary/50 border-border/50"
              dir="ltr"
            />
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-64 overflow-y-auto p-1">
              {filteredGlyphs.map((g, i) => {
                const glyphIdx = glyphs.indexOf(g);
                const char = g.codePoint > 31 ? String.fromCodePoint(g.codePoint) : "·";
                const isSelected = selectedGlyphIndex === glyphIdx;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedGlyphIndex(isSelected ? null : glyphIdx)}
                    className={`
                      flex flex-col items-center justify-center p-1.5 rounded-lg text-sm font-mono
                      transition-all duration-200 border
                      ${isSelected
                        ? 'gradient-primary text-primary-foreground border-primary glow-primary scale-105'
                        : 'bg-secondary/50 hover:bg-secondary border-border/30 hover:border-primary/30 hover:scale-105'
                      }
                    `}
                    title={`U+${g.codePoint.toString(16).toUpperCase().padStart(4, "0")}`}
                  >
                    <span className="text-base leading-tight">{char}</span>
                    <span className={`text-[8px] leading-tight ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {g.codePoint.toString(16).toUpperCase().padStart(4, "0")}
                    </span>
                  </button>
                );
              })}
            </div>
            {filteredGlyphs.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا نتائج</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Glyph Editor */}
      {selectedGlyph && selectedGlyphIndex !== null && (
        <Card className="glass-card border-primary/30 glow-primary overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 flex items-center justify-center rounded-xl gradient-primary text-2xl font-mono text-primary-foreground shadow-lg">
                  {selectedGlyph.codePoint > 31 ? String.fromCodePoint(selectedGlyph.codePoint) : "·"}
                </div>
                <div>
                  <Badge className="font-mono text-xs gradient-primary border-0">
                    U+{selectedGlyph.codePoint.toString(16).toUpperCase().padStart(4, "0")}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    إجمالي: <span className="font-mono font-bold text-foreground">{selectedGlyph.widthCol1 + selectedGlyph.widthCol2 + selectedGlyph.widthCol3}</span>px
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleResetAll}>
                  <RotateCcw className="h-3 w-3" />
                  إعادة الكل
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedGlyphIndex(null)}>
                  ✕
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <SliderField
              label="إزاحة يسار"
              tag="Col1"
              value={selectedGlyph.widthCol1}
              onChange={(v) => onGlyphUpdate(selectedGlyphIndex, { widthCol1: v })}
              onReset={() => handleReset("widthCol1")}
              min={-20} max={50}
              color="hsl(var(--primary))"
            />
            <SliderField
              label="عرض الحرف"
              tag="Col2"
              value={selectedGlyph.widthCol2}
              onChange={(v) => onGlyphUpdate(selectedGlyphIndex, { widthCol2: v })}
              onReset={() => handleReset("widthCol2")}
              min={0} max={80}
              color="hsl(var(--accent))"
            />
            <SliderField
              label="إزاحة يمين"
              tag="Col3"
              value={selectedGlyph.widthCol3}
              onChange={(v) => onGlyphUpdate(selectedGlyphIndex, { widthCol3: v })}
              onReset={() => handleReset("widthCol3")}
              min={-20} max={50}
              color="hsl(var(--primary))"
            />

            {/* Visual width diagram */}
            <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-muted-foreground text-center">توزيع العرض</p>
              <div className="flex items-center gap-0.5 h-6 rounded-lg overflow-hidden">
                {selectedGlyph.widthCol1 > 0 && (
                  <div
                    className="h-full gradient-primary opacity-50 flex items-center justify-center text-[9px] text-primary-foreground font-mono"
                    style={{ flex: selectedGlyph.widthCol1 }}
                  >{selectedGlyph.widthCol1}</div>
                )}
                <div
                  className="h-full gradient-accent flex items-center justify-center text-[9px] text-accent-foreground font-mono"
                  style={{ flex: Math.max(selectedGlyph.widthCol2, 1) }}
                >{selectedGlyph.widthCol2}</div>
                {selectedGlyph.widthCol3 > 0 && (
                  <div
                    className="h-full gradient-primary opacity-50 flex items-center justify-center text-[9px] text-primary-foreground font-mono"
                    style={{ flex: selectedGlyph.widthCol3 }}
                  >{selectedGlyph.widthCol3}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function SliderField({ label, tag, value, onChange, onReset, min, max, color }: {
  label: string;
  tag: string;
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
  min: number;
  max: number;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{tag}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            className="w-16 h-8 text-xs text-center font-mono bg-secondary/50 border-border/50"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={onReset} title="إعادة للأصل">
            <RotateCcw className="h-3.5 w-3.5" />
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
