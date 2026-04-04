import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Type, RotateCcw, MousePointerClick } from "lucide-react";
import type { NLGGlyph, NLGHeader } from "@/lib/nlgParser";

interface TextSimulatorProps {
  glyphs: NLGGlyph[];
  pages: HTMLCanvasElement[];
  header: NLGHeader;
  onGlyphUpdate: (index: number, updates: Partial<Pick<NLGGlyph, "widthCol1" | "widthCol2" | "widthCol3">>) => void;
}

const TextSimulator = ({ glyphs, pages, header, onGlyphUpdate }: TextSimulatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testText, setTestText] = useState("مرحبا بالعالم 123");
  const [selectedCharIndex, setSelectedCharIndex] = useState<number | null>(null);
  const [charPositions, setCharPositions] = useState<{ x: number; width: number; glyphIdx: number; char: string }[]>([]);

  // Build a map from codePoint to glyph index
  const glyphMap = useCallback(() => {
    const map = new Map<number, number>();
    glyphs.forEach((g, i) => {
      map.set(g.codePoint, i);
    });
    return map;
  }, [glyphs]);

  // Render the test text on canvas simulating the game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pages.length) return;

    const ctx = canvas.getContext("2d")!;
    const scale = 2; // For sharp rendering
    const canvasWidth = canvas.clientWidth;
    const renderHeight = header.renderHeight;
    const padding = 16;
    const canvasH = renderHeight * scale + padding * 2;

    canvas.width = canvasWidth * scale;
    canvas.height = canvasH;
    canvas.style.height = `${canvasH / scale}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const map = glyphMap();
    const chars = [...testText];
    let currentX = padding * scale;
    const baseY = padding;
    const positions: typeof charPositions = [];

    for (let ci = 0; ci < chars.length; ci++) {
      const char = chars[ci];
      const cp = char.codePointAt(0) ?? 0;
      const glyphIdx = map.get(cp);

      if (glyphIdx === undefined) {
        // Unknown char, advance by a default width
        positions.push({ x: currentX / scale, width: 10, glyphIdx: -1, char });
        currentX += 10 * scale;
        continue;
      }

      const g = glyphs[glyphIdx];
      const cellW = g.x2 - g.x1;
      const cellH = g.y2 - g.y1;
      const totalAdvance = g.widthCol1 + g.widthCol2 + g.widthCol3;

      // Draw the glyph from the atlas page
      if (cellW > 0 && cellH > 0 && pages[g.page]) {
        const srcCanvas = pages[g.page];
        // Left offset
        const drawX = currentX + g.widthCol1 * scale;

        ctx.drawImage(
          srcCanvas,
          g.x1, g.y1, cellW, cellH,
          drawX, baseY * scale, cellW * scale, cellH * scale
        );
      }

      positions.push({
        x: currentX / scale,
        width: totalAdvance,
        glyphIdx,
        char
      });

      currentX += totalAdvance * scale;
    }

    // Draw selection highlight
    if (selectedCharIndex !== null && positions[selectedCharIndex]) {
      const pos = positions[selectedCharIndex];
      ctx.strokeStyle = "hsl(217, 91%, 60%)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        pos.x * scale,
        baseY * scale - 2,
        pos.width * scale,
        renderHeight * scale + 4
      );
    }

    setCharPositions(positions);
  }, [testText, glyphs, pages, header, glyphMap, selectedCharIndex]);

  // Handle canvas click to select character
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // Find which character was clicked
    for (let i = 0; i < charPositions.length; i++) {
      const pos = charPositions[i];
      if (clickX >= pos.x && clickX < pos.x + pos.width) {
        setSelectedCharIndex(i);
        return;
      }
    }
    setSelectedCharIndex(null);
  };

  const selectedGlyphData = selectedCharIndex !== null && charPositions[selectedCharIndex]
    ? (() => {
        const pos = charPositions[selectedCharIndex];
        if (pos.glyphIdx === -1) return null;
        return { glyph: glyphs[pos.glyphIdx], index: pos.glyphIdx, char: pos.char };
      })()
    : null;

  // Find original values for reset
  const handleReset = (field: "widthCol1" | "widthCol2" | "widthCol3") => {
    if (!selectedGlyphData) return;
    const g = selectedGlyphData.glyph;
    if (!g.rawLine) return;
    const match = g.rawLine.match(/Width\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
    if (!match) return;
    const origValues = { widthCol1: parseInt(match[1]), widthCol2: parseInt(match[2]), widthCol3: parseInt(match[3]) };
    onGlyphUpdate(selectedGlyphData.index, { [field]: origValues[field] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Type className="h-5 w-5" />
          محاكي نص اللعبة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test text input */}
        <Input
          value={testText}
          onChange={(e) => { setTestText(e.target.value); setSelectedCharIndex(null); }}
          placeholder="اكتب جملة تجريبية..."
          className="text-lg"
          dir="ltr"
        />

        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg cursor-pointer border border-border"
            onClick={handleCanvasClick}
          />
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-muted-foreground bg-background/80 rounded px-2 py-1">
            <MousePointerClick className="h-3 w-3" />
            اضغط على حرف لتعديله
          </div>
        </div>

        {/* Glyph editor */}
        {selectedGlyphData && (
          <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-muted rounded-lg border text-xl font-mono">
                  {selectedGlyphData.char}
                </div>
                <div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    U+{selectedGlyphData.glyph.codePoint.toString(16).toUpperCase().padStart(4, "0")}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    إجمالي التقدم: {selectedGlyphData.glyph.widthCol1 + selectedGlyphData.glyph.widthCol2 + selectedGlyphData.glyph.widthCol3}px
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCharIndex(null)}>
                إغلاق
              </Button>
            </div>

            {/* Sliders */}
            <div className="space-y-3">
              <SliderField
                label="إزاحة يسار (widthCol1)"
                value={selectedGlyphData.glyph.widthCol1}
                onChange={(v) => onGlyphUpdate(selectedGlyphData.index, { widthCol1: v })}
                onReset={() => handleReset("widthCol1")}
                min={-20}
                max={50}
              />
              <SliderField
                label="عرض الحرف (widthCol2)"
                value={selectedGlyphData.glyph.widthCol2}
                onChange={(v) => onGlyphUpdate(selectedGlyphData.index, { widthCol2: v })}
                onReset={() => handleReset("widthCol2")}
                min={0}
                max={80}
              />
              <SliderField
                label="إزاحة يمين (widthCol3)"
                value={selectedGlyphData.glyph.widthCol3}
                onChange={(v) => onGlyphUpdate(selectedGlyphData.index, { widthCol3: v })}
                onReset={() => handleReset("widthCol3")}
                min={-20}
                max={50}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function SliderField({ label, value, onChange, onReset, min, max }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onReset: () => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            className="w-20 h-7 text-xs text-center"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReset} title="إعادة للأصل">
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
