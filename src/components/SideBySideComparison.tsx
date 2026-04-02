import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { GitCompareArrows, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface SideBySideComparisonProps {
  newImageUrl: string;
  originalImageUrl: string;
}

const SideBySideComparison = ({ newImageUrl, originalImageUrl }: SideBySideComparisonProps) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(8, Math.max(0.5, z + (e.deltaY > 0 ? -0.2 : 0.2))));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    setPan({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
  }, [isPanning, panStart]);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const imageStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "top left",
    imageRendering: "pixelated",
    transition: isPanning ? "none" : "transform 0.15s ease",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5" />
          مقارنة جنب-لجنب
        </CardTitle>
        <div className="flex items-center gap-3 flex-wrap pt-2">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(8, z + 0.5))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-xs text-muted-foreground">تكبير</span>
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={0.5}
              max={8}
              step={0.1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="grid grid-cols-2 gap-2 select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setIsPanning(false)}
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
        >
          {/* New font */}
          <div className="space-y-1">
            <p className="text-xs text-center text-primary font-semibold">الخط الجديد</p>
            <div className="border border-border rounded-lg overflow-hidden bg-foreground h-[300px] md:h-[500px]">
              <img src={newImageUrl} alt="الخط الجديد" className="max-w-none" style={imageStyle} />
            </div>
          </div>
          {/* Original font */}
          <div className="space-y-1">
            <p className="text-xs text-center text-muted-foreground font-semibold">الخط الأصلي</p>
            <div className="border border-border rounded-lg overflow-hidden bg-foreground h-[300px] md:h-[500px]">
              <img src={originalImageUrl} alt="الخط الأصلي" className="max-w-none" style={imageStyle} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SideBySideComparison;
