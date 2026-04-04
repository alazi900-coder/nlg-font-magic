import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseNLG, generateNLGText, type NLGData, type NLGGlyph } from "@/lib/nlgParser";
import { renderFont, canvasesToBlob, type RenderedResult } from "@/lib/fontRenderer";
import { Upload, Download, Eye, FileText, Image as ImageIcon, Loader2, Archive, GitCompare, ClipboardCopy, Bug, Sparkles } from "lucide-react";
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

  // Auto-load on first render
  useState(() => {
    loadReference();
  });

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
      // Reset previous results
      setResult(null);
      setPreviewUrls([]);
      setSelectedGlyph(null);
      setShowDiff(false);
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
    loadReference();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nlgData) return;

    setIsProcessing(true);
    setFontName(file.name.replace(/\.ttf$/i, ""));

    try {
      const buffer = await file.arrayBuffer();
      const rendered = await renderFont(buffer, nlgData.header, nlgData.glyphs);
      setResult(rendered);
      setEditedGlyphs(rendered.glyphs.map(g => ({ ...g })));

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

  // Get the active glyphs (edited or original)
  const activeGlyphs = editedGlyphs ?? result?.glyphs ?? [];

  // Handle glyph width updates from the simulator
  const handleGlyphUpdate = useCallback((index: number, updates: Partial<Pick<NLGGlyph, "widthCol1" | "widthCol2" | "widthCol3">>) => {
    setEditedGlyphs(prev => {
      if (!prev) return prev;
      const next = [...prev];
      const g = { ...next[index], ...updates };
      // Update rawLine to reflect new values
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

  // Compute diff between original and generated
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
      if (i >= origLines.length) {
        diffs.push({ line: i + 1, original: "", generated: gen, status: "added" });
      } else if (i >= newLines.length) {
        diffs.push({ line: i + 1, original: orig, generated: "", status: "removed" });
      } else if (orig !== gen) {
        diffs.push({ line: i + 1, original: orig, generated: gen, status: "changed" });
      }
    }
    return diffs;
  }, [showDiff, result, nlgData, originalText, getGeneratedText]);

  const downloadTxt = () => {
    if (!result || !nlgData) return;
    const text = generateNLGText(result.header, activeGlyphs, fontName || undefined, nlgData.rawHeaderLines);
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

  const downloadZip = async () => {
    if (!result || !nlgData) return;
    const zip = new JSZip();
    const name = fontName || "font";
    const text = generateNLGText(result.header, result.glyphs, name, nlgData.rawHeaderLines);
    zip.file(`${name}.txt`, text);
    const blobs = await canvasesToBlob(result.pages);
    blobs.forEach((blob, i) => {
      zip.file(`${name}_page${i}.png`, blob);
    });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.zip`;
    a.click();
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
      const o = origLines[i] ?? "";
      const g = genLines[i] ?? "";
      if (o !== g) {
        diffCount++;
        diffs.push(`سطر ${i + 1}:\n  أصلي: ${o}\n  ناتج: ${g}`);
      }
    }

    // Check for glyphs with rawLine missing
    const missingRawLine = result ? result.glyphs.filter(g => !g.rawLine).length : 0;

    // Sample first 5 and last 5 glyphs
    const sampleGlyphs = (list: NLGGlyph[]) => {
      const first5 = list.slice(0, 5).map(g => g.rawLine || `CP:${g.codePoint} W:${g.widthCol1},${g.widthCol2},${g.widthCol3} [${g.x1},${g.y1},${g.x2},${g.y2}] P${g.page}`);
      const last5 = list.slice(-5).map(g => g.rawLine || `CP:${g.codePoint} W:${g.widthCol1},${g.widthCol2},${g.widthCol3} [${g.x1},${g.y1},${g.x2},${g.y2}] P${g.page}`);
      return [...first5, "...", ...last5].join("\n  ");
    };

    const report = `
=== تقرير تشخيصي NLG Font Updater v2.0 ===
التاريخ: ${new Date().toISOString()}

--- ملف المرجع ---
اسم الملف: ${nlgFileName}
عدد الأحرف المحللة: ${nlgData.glyphs.length}
عدد الصفحات: ${nlgData.header.pageCount}
حجم الخط: ${nlgData.header.fontSize}
حجم الصفحة: ${nlgData.header.pageSize}
RenderHeight: ${nlgData.header.renderHeight}
Ascent: ${nlgData.header.ascent}
عدد أسطر الملف الأصلي: ${origLines.length}

--- الخط الجديد ---
اسم الخط: ${fontName || "(لم يُرفع)"}
${result ? `عدد الصفحات الناتجة: ${result.pages.length}
عدد الأحرف الناتجة: ${result.glyphs.length}
أحرف بدون rawLine: ${missingRawLine}` : "لم تتم المعالجة بعد"}

--- المقارنة ---
عدد أسطر الملف الناتج: ${genLines.length}
عدد الأسطر المختلفة: ${diffCount}
${diffs.length > 0 ? `\nالفروقات:\n${diffs.join("\n")}` : "✅ لا فروقات"}

--- عينة أحرف (أصلي) ---
  ${sampleGlyphs(nlgData.glyphs)}

${result ? `--- عينة أحرف (ناتج) ---
  ${sampleGlyphs(result.glyphs)}` : ""}

--- Header الأصلي ---
${nlgData.rawHeaderLines.join("\n")}

=== نهاية التقرير ===
`.trim();

    navigator.clipboard.writeText(report).then(() => {
      alert("✅ تم نسخ التقرير! الصقه في المحادثة.");
    }).catch(() => {
      // Fallback: download as file
      const blob = new Blob([report], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diagnostic_report.txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 md:p-8" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">v2.0</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Header */}
        <div className="text-center space-y-3 py-4">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
            NLG Font Updater
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            أداة تحديث خطوط NLG — ارفع خط TTF جديد لتوليد صورة وإحداثيات محدّثة
          </p>
        </div>

        {/* Stats */}
        {nlgData && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">📄 ملف المرجع</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>{nlgFileName}</span>
                {useCustomNlg && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetToDefault}>
                    إعادة للافتراضي
                  </Button>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-primary/10 p-4 space-y-1">
                <p className="text-2xl font-bold text-primary">{nlgData.glyphs.length}</p>
                <p className="text-xs text-muted-foreground">حرف محلّل</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-4 space-y-1">
                <p className="text-2xl font-bold text-primary">{nlgData.header.pageCount}</p>
                <p className="text-xs text-muted-foreground">صفحة</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-4 space-y-1">
                <p className="text-2xl font-bold text-primary">{nlgData.header.fontSize}</p>
                <p className="text-xs text-muted-foreground">حجم الخط</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NLG File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              ملف الإحداثيات (NLG)
            </CardTitle>
            <CardDescription>
              اختياري — ارفع ملف .txt مخصص أو استخدم gb_3.txt الافتراضي
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all duration-200">
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <FileText className="h-6 w-6" />
                <span className="text-xs">اضغط لرفع ملف إحداثيات NLG (.txt)</span>
              </div>
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleNlgUpload}
              />
            </label>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="border-2 hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              رفع خط TTF جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all duration-200">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="p-3 rounded-full bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <span className="text-sm font-medium">اضغط لاختيار ملف TTF</span>
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
              <Button onClick={downloadZip} variant="outline" className="gap-2">
                <Archive className="h-4 w-4" />
                تحميل الكل (ZIP)
              </Button>
              <Button onClick={() => setShowDiff(!showDiff)} variant={showDiff ? "default" : "outline"} className="gap-2">
                <GitCompare className="h-4 w-4" />
                مقارنة الإحداثيات
              </Button>
              <Button onClick={generateReport} variant="outline" className="gap-2">
                <Bug className="h-4 w-4" />
                تقرير تشخيصي
              </Button>
            </div>

            {/* Diff View */}
            {showDiff && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitCompare className="h-5 w-5" />
                    مقارنة ملف الإحداثيات (الأصلي ↔ الناتج)
                  </CardTitle>
                  <CardDescription>
                    {diffLines.length === 0
                      ? "✅ الملفان متطابقان تماماً (ما عدا اسم الخط)"
                      : `⚠️ يوجد ${diffLines.length} سطر مختلف`}
                  </CardDescription>
                </CardHeader>
                {diffLines.length > 0 && (
                  <CardContent>
                    <div className="max-h-96 overflow-auto rounded-lg border border-border text-xs font-mono" dir="ltr">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="px-2 py-1 text-left w-12">#</th>
                            <th className="px-2 py-1 text-left">الأصلي</th>
                            <th className="px-2 py-1 text-left">الناتج</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffLines.map((d) => (
                            <tr key={d.line} className={
                              d.status === "changed" ? "bg-yellow-500/10" :
                              d.status === "added" ? "bg-green-500/10" :
                              "bg-red-500/10"
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
                <div className="border border-border rounded-lg overflow-auto bg-foreground p-2">
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

            {/* Side-by-side comparison */}
            <SideBySideComparison
              newImageUrl={previewUrls[selectedPage]}
              originalImageUrl="/fonts/gb_3.png"
              pageIndex={selectedPage}
              totalPages={previewUrls.length}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
