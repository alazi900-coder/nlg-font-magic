import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseNLG, generateNLGText, type NLGData, type NLGGlyph } from "@/lib/nlgParser";
import { renderFont, canvasesToBlob, type RenderedResult } from "@/lib/fontRenderer";
import { Upload, Download, Eye, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import GlyphDetailPanel from "@/components/GlyphDetailPanel";
import GlyphPreviewCanvas from "@/components/GlyphPreviewCanvas";

const Index = () => {
  const [nlgData, setNlgData] = useState<NLGData | null>(null);
  const [result, setResult] = useState<RenderedResult | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fontName, setFontName] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedGlyph, setSelectedGlyph] = useState<NLGGlyph | null>(null);

  // Load the reference NLG file on mount
  const loadReference = useCallback(async () => {
    if (isLoaded) return;
    try {
      const response = await fetch("/fonts/gb_3.txt");
      const text = await response.text();
      const data = parseNLG(text);
      setNlgData(data);
      setIsLoaded(true);
    } catch (err) {
      console.error("Failed to load reference NLG:", err);
    }
  }, [isLoaded]);

  // Auto-load on first render
  useState(() => {
    loadReference();
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nlgData) return;

    setIsProcessing(true);
    setFontName(file.name.replace(/\.ttf$/i, ""));

    try {
      const buffer = await file.arrayBuffer();
      const rendered = await renderFont(buffer, nlgData.header, nlgData.glyphs);
      setResult(rendered);

      // Generate preview URLs
      const urls = rendered.pages.map((canvas) => canvas.toDataURL("image/png"));
      setPreviewUrls(urls);
      setSelectedPage(0);
    } catch (err) {
      console.error("Rendering failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTxt = () => {
    if (!result || !nlgData) return;
    const text = generateNLGText(result.header, result.glyphs, fontName || undefined);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fontName || "font"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadImages = async () => {
    if (!result) return;
    const blobs = await canvasesToBlob(result.pages);
    blobs.forEach((blob, i) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fontName || "font"}_page${i}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">NLG Font Updater</h1>
          <p className="text-muted-foreground">
            أداة تحديث خطوط NLG — ارفع خط TTF جديد لتوليد صورة وإحداثيات محدّثة
          </p>
        </div>

        {/* Stats */}
        {nlgData && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">ملف المرجع</CardTitle>
              <CardDescription>gb_3.txt — {nlgData.glyphs.length} حرف، {nlgData.header.pageCount} صفحة</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              رفع خط TTF جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <span className="text-sm">اضغط لاختيار ملف TTF</span>
              </div>
              <input
                type="file"
                accept=".ttf,.otf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isProcessing || !isLoaded}
              />
            </label>
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>جاري المعالجة...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && previewUrls.length > 0 && (
          <>
            {/* Download buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button onClick={downloadTxt} className="gap-2">
                <FileText className="h-4 w-4" />
                تحميل ملف الإحداثيات (.txt)
              </Button>
              <Button onClick={downloadImages} variant="secondary" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                تحميل الصور ({result.pages.length} صفحة)
              </Button>
            </div>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  معاينة — صفحة {selectedPage + 1} من {previewUrls.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Page selector */}
                <div className="flex gap-1 flex-wrap">
                  {previewUrls.map((_, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={selectedPage === i ? "default" : "outline"}
                      onClick={() => { setSelectedPage(i); setSelectedGlyph(null); }}
                      className="w-10 h-8 text-xs"
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>

                {/* Image preview with clickable glyphs */}
                <div className="border border-border rounded-lg overflow-auto bg-muted/30 p-2">
                  <GlyphPreviewCanvas
                    imageUrl={previewUrls[selectedPage]}
                    glyphs={result.glyphs}
                    pageIndex={selectedPage}
                    selectedGlyph={selectedGlyph}
                    onGlyphClick={setSelectedGlyph}
                  />
                </div>

                {/* Glyph detail panel */}
                {selectedGlyph && (
                  <GlyphDetailPanel
                    glyph={selectedGlyph}
                    onClose={() => setSelectedGlyph(null)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Comparison with original */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">مقارنة مع الخط الأصلي</CardTitle>
                <CardDescription>الصورة الأصلية (gb_3.png)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-border rounded-lg overflow-auto bg-muted/30 p-2">
                  <img
                    src="/fonts/gb_3.png"
                    alt="الخط الأصلي"
                    className="max-w-full"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
