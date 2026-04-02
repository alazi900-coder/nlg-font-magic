import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NLGGlyph } from "@/lib/nlgParser";

interface GlyphDetailPanelProps {
  glyph: NLGGlyph;
  onClose: () => void;
}

const GlyphDetailPanel = ({ glyph, onClose }: GlyphDetailPanelProps) => {
  const charDisplay = glyph.codePoint > 31
    ? String.fromCodePoint(glyph.codePoint)
    : "—";

  const glyphWidth = glyph.x2 - glyph.x1;
  const glyphHeight = glyph.y2 - glyph.y1;

  return (
    <Card className="border-primary/30 bg-card shadow-lg">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">تفاصيل الحرف</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Character display */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 flex items-center justify-center bg-muted rounded-lg border border-border text-2xl font-mono">
            {charDisplay}
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Unicode</div>
            <Badge variant="secondary" className="font-mono">
              U+{glyph.codePoint.toString(16).toUpperCase().padStart(4, "0")}
            </Badge>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <DetailItem label="المعرّف" value={glyph.charOrUnicode} />
          <DetailItem label="الصفحة" value={`${glyph.page + 1}`} />
          <DetailItem label="الموقع (x1, y1)" value={`${glyph.x1}, ${glyph.y1}`} />
          <DetailItem label="الموقع (x2, y2)" value={`${glyph.x2}, ${glyph.y2}`} />
          <DetailItem label="العرض" value={`${glyphWidth}px`} />
          <DetailItem label="الارتفاع" value={`${glyphHeight}px`} />
          <DetailItem label="Width Col1" value={`${glyph.widthCol1}`} />
          <DetailItem label="Width Col2" value={`${glyph.widthCol2}`} />
          <DetailItem label="Width Col3" value={`${glyph.widthCol3}`} />
        </div>
      </CardContent>
    </Card>
  );
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-medium text-foreground">{value}</div>
    </div>
  );
}

export default GlyphDetailPanel;
