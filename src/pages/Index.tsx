import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseNLG, generateNLGText, type NLGData, type NLGGlyph } from "@/lib/nlgParser";
import { renderFont, canvasesToBlob, type RenderedResult } from "@/lib/fontRenderer";
import {
  Upload, FileText, Loader2, Archive, GitCompare, Bug,
  Zap, Eye, Image as ImageIcon, Layers, ChevronLeft, ChevronRight,
  RefreshCw, FileDown, Sparkles
} from "lucide-react";
import JSZip from "jszip";
import GlyphDetailPanel from "@/components/GlyphDetailPanel";
import GlyphPreviewCanvas from "@/components/GlyphPreviewCanvas";
import SideBySideComparison from "@/components/SideBySideComparison";
import TextSimulator from "@/components/TextSimulator";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const [nlgData, setNlgData] = useState<NLGData | null>(null);
  const [result, setResult] = useState<RenderedResult | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fontName, setFontName] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedGlyph, setSelectedGlyph] = useState<NLGGlyph | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [originalText, setOriginalText] = useState<string>("");
  const [nlgFileName, setNlgFileName] = useState<string>("gb_3.txt (افتراضي)");
  const [useCustomNlg, setUseCustomNlg] = useState(false);
  const [editedGlyphs, setEditedGlyphs] = useState<NLGGlyph[] | null>(null);

  // Load the reference NLG file on mount
  const loadReference = useCallback(async () => {
    if (isLoaded) return;
    try {
      const response = await fetch("/fonts/gb_3.txt");
      const text = await response.text();
      setOriginalText(text);
      const data = parseNLG(text);
      setNlgData(data);
      setIsLoaded(true);
    } catch (err) {
      console.error("Failed to load reference NLG:", err);
    }
  }, [isLoaded]);

  useState(() => { loadReference(); });

  const handleNlgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setOriginalText(text);
      const data = parseNLG(text);
      setNlgData(data);
      setIsLoaded(true);
      setUseCustomNlg(true);
      setNlgFileName(file.name);
      setResult(null);
      setPreviewUrls([]);
      setSelectedGlyph(null);
      setShowDiff(false);
      setEditedGlyphs(null);
    } catch (err) {
      console.error("Failed to parse NLG file:", err);
    }
  };

  const resetToDefault = async () => {
    setUseCustomNlg(false);
    setNlgFileName("gb_3.txt (افتراضي)");
    setResult(null);
    setPreviewUrls([]);
    setSelectedGlyph(null);
    setShowDiff(false);
    setIsLoaded(false);
    setEditedGlyphs(null);
    loadReference();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nlgData) return;
    setIsProcessing(true);
    setFontName(file.name.replace(/\.(ttf|otf)$/i, ""));
    try {
      const buffer = await file.arrayBuffer();
      const rendered = await renderFont(buffer, nlgData.header, nlgData.glyphs);
      setResult(rendered);
      setEditedGlyphs(rendered.glyphs.map(g => ({ ...g })));
      const urls = rendered.pages.map((canvas) => canvas.toDataURL("image/png"));
      setPreviewUrls(urls);
      setSelectedPage(0);
    } catch (err) {
      console.error("Rendering failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeGlyphs = editedGlyphs ?? result?.glyphs ?? [];

  const handleGlyphUpdate = useCallback((index: number, updates: Partial<Pick<NLGGlyph, "widthCol1" | "widthCol2" | "widthCol3">>) => {
    setEditedGlyphs(prev => {
      if (!prev) return prev;
      const next = [...prev];
      const g = { ...next[index], ...updates };
      if (g.rawLine) {
        g.rawLine = g.rawLine.replace(
          /Width\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/,
          `Width ${g.widthCol1} ${g.widthCol2} ${g.widthCol3}`
        );
      }
      next[index] = g;
      return next;
    });
  }, []);

  const getGeneratedText = useCallback(() => {
    if (!result || !nlgData) return "";
    return generateNLGText(result.header, activeGlyphs, fontName || undefined, nlgData.rawHeaderLines);
  }, [result, nlgData, fontName, activeGlyphs]);

  const diffLines = useMemo(() => {
    if (!showDiff || !result || !nlgData) return [];
    const origLines = originalText.split(/\r?\n/);
    const newText = getGeneratedText();
    const newLines = newText.split(/\r?\n/);
    const maxLen = Math.max(origLines.length, newLines.length);
    const diffs: { line: number; original: string; generated: string; status: "same" | "changed" | "added" | "removed" }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i] ?? "";
      const gen = newLines[i] ?? "";
      if (i >= origLines.length) diffs.push({ line: i + 1, original: "", generated: gen, status: "added" });
      else if (i >= newLines.length) diffs.push({ line: i + 1, original: orig, generated: "", status: "removed" });
      else if (orig !== gen) diffs.push({ line: i + 1, original: orig, generated: gen, status: "changed" });
    }
    return diffs;
  }, [showDiff, result, nlgData, originalText, getGeneratedText]);

  const downloadTxt = () => {
    if (!result || !nlgData) return;
    const text = generateNLGText(result.header, activeGlyphs, fontName || undefined, nlgData.rawHeaderLines);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fontName || "font"}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadImages = async () => {
    if (!result) return;
    const blobs = await canvasesToBlob(result.pages);
    blobs.forEach((blob, i) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${fontName || "font"}_page${i}.png`; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const downloadZip = async () => {
    if (!result || !nlgData) return;
    const zip = new JSZip();
    const name = fontName || "font";
    const text = generateNLGText(result.header, activeGlyphs, name, nlgData.rawHeaderLines);
    zip.file(`${name}.txt`, text);
    const blobs = await canvasesToBlob(result.pages);
    blobs.forEach((blob, i) => { zip.file(`${name}_page${i}.png`, blob); });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.zip`; a.click();
    URL.revokeObjectURL(url);
  };

  const generateReport = () => {
    if (!nlgData) return;
    const genText = getGeneratedText();
    const origLines = originalText.split(/\r?\n/);
    const genLines = genText ? genText.split(/\r?\n/) : [];
    const maxLen = Math.max(origLines.length, genLines.length);
    let diffCount = 0;
    const diffs: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i] ?? ""; const g = genLines[i] ?? "";
      if (o !== g) { diffCount++; diffs.push(`سطر ${i + 1}:\n  أصلي: ${o}\n  ناتج: ${g}`); }
    }
    const missingRawLine = result ? result.glyphs.filter(g => !g.rawLine).length : 0;
    const sampleGlyphs = (list: NLGGlyph[]) => {
      const first5 = list.slice(0, 5).map(g => g.rawLine || `CP:${g.codePoint}`);
      const last5 = list.slice(-5).map(g => g.rawLine || `CP:${g.codePoint}`);
      return [...first5, "...", ...last5].join("\n  ");
    };
    const report = `=== تقرير تشخيصي NLG Font Updater v2.0 ===\nالتاريخ: ${new Date().toISOString()}\n\n--- ملف المرجع ---\nاسم الملف: ${nlgFileName}\nعدد الأحرف: ${nlgData.glyphs.length}\nعدد الصفحات: ${nlgData.header.pageCount}\nحجم الخط: ${nlgData.header.fontSize}\n\n--- الخط الجديد ---\nاسم الخط: ${fontName || "(لم يُرفع)"}\n${result ? `عدد الصفحات الناتجة: ${result.pages.length}\nعدد الأحرف الناتجة: ${result.glyphs.length}\nأحرف بدون rawLine: ${missingRawLine}` : "لم تتم المعالجة بعد"}\n\n--- المقارنة ---\nعدد أسطر الملف الناتج: ${genLines.length}\nعدد الأسطر المختلفة: ${diffCount}\n${diffs.length > 0 ? `\nالفروقات:\n${diffs.join("\n")}` : "✅ لا فروقات"}\n\n--- عينة أحرف ---\n  ${sampleGlyphs(nlgData.glyphs)}\n\n--- Header ---\n${nlgData.rawHeaderLines.join("\n")}\n\n=== نهاية التقرير ===`;
    navigator.clipboard.writeText(report).then(() => {
      alert("✅ تم نسخ التقرير!");
    }).catch(() => {
      const blob = new Blob([report], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "diagnostic_report.txt"; a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <Badge variant="outline" className="text-xs font-mono">v2.0</Badge>
        </div>

        <div className="text-center space-y-3 py-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
            <Zap className="h-3.5 w-3.5" />
            أداة تحديث خطوط NLG
          </div>
          <h1 className="text-4xl md:text-5xl font-black gradient-text leading-tight">
            NLG Font Updater
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            ارفع خط TTF جديد لتوليد صور الحروف وملف الإحداثيات تلقائياً
          </p>
        </div>

        {/* Stats */}
        {nlgData && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Layers className="h-4 w-4" />} value={nlgData.glyphs.length} label="حرف" color="primary" />
            <StatCard icon={<ImageIcon className="h-4 w-4" />} value={nlgData.header.pageCount} label="صفحة" color="accent" />
            <StatCard icon={<Sparkles className="h-4 w-4" />} value={nlgData.header.fontSize} label="حجم الخط" color="primary" />
          </div>
        )}

        {/* Reference file info */}
        {nlgData && (
          <Card className="glass-card">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">ملف المرجع:</span>
                <span className="font-medium">{nlgFileName}</span>
              </div>
              {useCustomNlg && (
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={resetToDefault}>
                  <RefreshCw className="h-3 w-3" /> افتراضي
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* NLG Upload */}
          <Card className="glass-card card-hover group">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-secondary">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                ملف الإحداثيات
              </CardTitle>
              <CardDescription className="text-xs">اختياري — ارفع ملف .txt مخصص</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center justify-center h-20 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Upload className="h-4 w-4" />
                  <span>رفع ملف NLG (.txt)</span>
                </div>
                <input type="file" accept=".txt" className="hidden" onChange={handleNlgUpload} />
              </label>
            </CardContent>
          </Card>

          {/* Font Upload */}
          <Card className="glass-card card-hover border-primary/20 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg gradient-primary">
                  <Upload className="h-4 w-4 text-primary-foreground" />
                </div>
                رفع خط جديد
              </CardTitle>
              <CardDescription className="text-xs">ارفع ملف TTF أو OTF</CardDescription>
            </CardHeader>
            <CardContent>
              <label className={`flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${isLoaded ? 'border-primary/30 hover:bg-primary/5 hover:border-primary/50' : 'border-border/30 opacity-50 cursor-not-allowed'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="text-primary font-medium">اختر ملف الخط</span>
                </div>
                <input type="file" accept=".ttf,.otf" className="hidden" onChange={handleFileUpload} disabled={isProcessing || !isLoaded} />
              </label>
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري المعالجة...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {result && previewUrls.length > 0 && (
          <>
            {/* Action buttons */}
            <Card className="glass-card">
              <CardContent className="py-4">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={downloadZip} className="gap-2 gradient-primary border-0 text-primary-foreground shadow-lg hover:opacity-90">
                    <Archive className="h-4 w-4" />
                    تحميل الكل (ZIP)
                  </Button>
                  <Button onClick={downloadTxt} variant="outline" className="gap-2">
                    <FileDown className="h-4 w-4" />
                    الإحداثيات
                  </Button>
                  <Button onClick={downloadImages} variant="outline" className="gap-2">
                    <ImageIcon className="h-4 w-4" />
                    الصور ({result.pages.length})
                  </Button>
                  <Button onClick={() => setShowDiff(!showDiff)} variant={showDiff ? "secondary" : "outline"} className="gap-2">
                    <GitCompare className="h-4 w-4" />
                    المقارنة
                  </Button>
                  <Button onClick={generateReport} variant="outline" className="gap-2">
                    <Bug className="h-4 w-4" />
                    تقرير
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Diff View */}
            {showDiff && (
              <Card className="glass-card overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-secondary">
                      <GitCompare className="h-4 w-4" />
                    </div>
                    مقارنة الإحداثيات
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {diffLines.length === 0 ? "✅ متطابقان تماماً" : `⚠️ ${diffLines.length} سطر مختلف`}
                  </CardDescription>
                </CardHeader>
                {diffLines.length > 0 && (
                  <CardContent>
                    <div className="max-h-80 overflow-auto rounded-lg border border-border/50 text-xs font-mono" dir="ltr">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                          <tr>
                            <th className="px-2 py-1.5 text-left w-10">#</th>
                            <th className="px-2 py-1.5 text-left">الأصلي</th>
                            <th className="px-2 py-1.5 text-left">الناتج</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffLines.map((d) => (
                            <tr key={d.line} className={
                              d.status === "changed" ? "bg-warning/10" :
                              d.status === "added" ? "bg-success/10" : "bg-destructive/10"
                            }>
                              <td className="px-2 py-1 text-muted-foreground">{d.line}</td>
                              <td className="px-2 py-1 text-destructive break-all">{d.original || "—"}</td>
                              <td className="px-2 py-1 text-primary break-all">{d.generated || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Preview */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-1.5 rounded-lg gradient-primary">
                    <Eye className="h-4 w-4 text-primary-foreground" />
                  </div>
                  معاينة الصفحات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Page nav */}
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={selectedPage === 0}
                    onClick={() => { setSelectedPage(p => p - 1); setSelectedGlyph(null); }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1 flex-wrap flex-1 justify-center">
                    {previewUrls.map((_, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant={selectedPage === i ? "default" : "ghost"}
                        onClick={() => { setSelectedPage(i); setSelectedGlyph(null); }}
                        className={`w-8 h-8 text-xs p-0 ${selectedPage === i ? 'gradient-primary border-0' : ''}`}
                      >
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={selectedPage === previewUrls.length - 1}
                    onClick={() => { setSelectedPage(p => p + 1); setSelectedGlyph(null); }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border border-border/30 rounded-xl overflow-auto bg-foreground/95 p-2">
                  <GlyphPreviewCanvas
                    imageUrl={previewUrls[selectedPage]}
                    glyphs={result.glyphs}
                    pageIndex={selectedPage}
                    selectedGlyph={selectedGlyph}
                    onGlyphClick={setSelectedGlyph}
                  />
                </div>

                {selectedGlyph && (
                  <GlyphDetailPanel glyph={selectedGlyph} onClose={() => setSelectedGlyph(null)} />
                )}
              </CardContent>
            </Card>

            {/* Text Simulator */}
            <TextSimulator
              glyphs={activeGlyphs}
              pages={result.pages}
              header={result.header}
              onGlyphUpdate={handleGlyphUpdate}
            />

            {/* Side-by-side */}
            <SideBySideComparison
              newImageUrl={previewUrls[selectedPage]}
              originalImageUrl="/fonts/gb_3.png"
              pageIndex={selectedPage}
              totalPages={previewUrls.length}
            />
          </>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-xs text-muted-foreground">
          NLG Font Updater v2.0 — أداة تحديث خطوط الألعاب
        </div>
      </div>
    </div>
  );
};

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: "primary" | "accent" }) {
  return (
    <Card className={`glass-card card-hover overflow-hidden relative`}>
      <div className={`absolute inset-0 opacity-5 ${color === 'primary' ? 'gradient-primary' : 'gradient-accent'}`} />
      <CardContent className="py-4 text-center relative">
        <div className={`inline-flex items-center justify-center p-2 rounded-xl mb-2 ${color === 'primary' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
          {icon}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default Index;
