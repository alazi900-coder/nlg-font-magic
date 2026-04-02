export interface NLGHeader {
  fontName: string;
  fontSize: number;
  colorR: number;
  colorG: number;
  colorB: number;
  pageSize: number;
  pageCount: number;
  textType: string;
  distribution: string;
  height: number;
  renderHeight: number;
  ascent: number;
  renderAscent: number;
  il: number;
  charSpacing: number;
  lineHeight: number;
}

export interface NLGGlyph {
  /** The raw character or unicode number string from the file */
  charOrUnicode: string;
  /** Resolved unicode code point */
  codePoint: number;
  /** Width columns from the file */
  widthCol1: number;
  widthCol2: number;
  widthCol3: number;
  /** Bounding box */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Page index (0-based) */
  page: number;
  /** Original raw line for reference */
  rawLine: string;
}

export interface NLGData {
  header: NLGHeader;
  glyphs: NLGGlyph[];
  rawHeaderLines: string[];
}

export function parseNLG(text: string): NLGData {
  const lines = text.split(/\r?\n/);

  // Parse header (lines 0-5)
  // Line 2: Font "DFPPOP2W9-GB" 18 color 255 255 255
  const fontLine = lines[2];
  const fontMatch = fontLine.match(/Font\s+"([^"]+)"\s+(\d+)\s+color\s+(\d+)\s+(\d+)\s+(\d+)/);
  
  // Line 3: PageSize 1024 PageCount 19 TextType color Distribution english
  const pageLine = lines[3];
  const pageMatch = pageLine.match(/PageSize\s+(\d+)\s+PageCount\s+(\d+)\s+TextType\s+(\w+)\s+Distribution\s+(\w+)/);

  // Line 4: Height 24 RenderHeight 28 Ascent 24 RenderAscent 21 IL 0
  const heightLine = lines[4];
  const heightMatch = heightLine.match(/Height\s+(\d+)\s+RenderHeight\s+(\d+)\s+Ascent\s+(\d+)\s+RenderAscent\s+(\d+)\s+IL\s+(\d+)/);

  // Line 5: CharSpacing 10 LineHeight 15
  const spacingLine = lines[5];
  const spacingMatch = spacingLine.match(/CharSpacing\s+(\d+)\s+LineHeight\s+(\d+)/);

  const header: NLGHeader = {
    fontName: fontMatch?.[1] ?? "Unknown",
    fontSize: parseInt(fontMatch?.[2] ?? "18"),
    colorR: parseInt(fontMatch?.[3] ?? "255"),
    colorG: parseInt(fontMatch?.[4] ?? "255"),
    colorB: parseInt(fontMatch?.[5] ?? "255"),
    pageSize: parseInt(pageMatch?.[1] ?? "1024"),
    pageCount: parseInt(pageMatch?.[2] ?? "19"),
    textType: pageMatch?.[3] ?? "color",
    distribution: pageMatch?.[4] ?? "english",
    height: parseInt(heightMatch?.[1] ?? "24"),
    renderHeight: parseInt(heightMatch?.[2] ?? "28"),
    ascent: parseInt(heightMatch?.[3] ?? "24"),
    renderAscent: parseInt(heightMatch?.[4] ?? "21"),
    il: parseInt(heightMatch?.[5] ?? "0"),
    charSpacing: parseInt(spacingMatch?.[1] ?? "10"),
    lineHeight: parseInt(spacingMatch?.[2] ?? "15"),
  };

  const rawHeaderLines = lines.slice(0, 6);

  // Parse glyphs (line 6 onwards until END)
  const glyphs: NLGGlyph[] = [];
  for (let i = 6; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "END" || line === "") continue;

    // Glyph <CHAR_OR_UNICODE> Width <col1> <col2> <col3> <x1> <y1> <x2> <y2> <page>
    const match = line.match(/^Glyph\s+(.+?)\s+Width\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)$/);
    if (!match) continue;

    const charOrUnicode = match[1];
    let codePoint: number;

    if (/^\d+$/.test(charOrUnicode)) {
      codePoint = parseInt(charOrUnicode);
    } else {
      codePoint = charOrUnicode.codePointAt(0) ?? 0;
    }

    glyphs.push({
      charOrUnicode,
      codePoint,
      widthCol1: parseInt(match[2]),
      widthCol2: parseInt(match[3]),
      widthCol3: parseInt(match[4]),
      x1: parseInt(match[5]),
      y1: parseInt(match[6]),
      x2: parseInt(match[7]),
      y2: parseInt(match[8]),
      page: parseInt(match[9]),
      rawLine: line,
    });
  }

  return { header, glyphs, rawHeaderLines };
}

export function generateNLGText(header: NLGHeader, glyphs: NLGGlyph[], newFontName?: string): string {
  const lines: string[] = [
    "NLG Font Description File",
    "Version 1.11",
    `Font "${newFontName ?? header.fontName}" ${header.fontSize} color ${header.colorR} ${header.colorG} ${header.colorB}`,
    `PageSize ${header.pageSize} PageCount ${header.pageCount} TextType ${header.textType} Distribution ${header.distribution}`,
    `Height ${header.height} RenderHeight ${header.renderHeight} Ascent ${header.ascent} RenderAscent ${header.renderAscent} IL ${header.il}`,
    `CharSpacing ${header.charSpacing} LineHeight ${header.lineHeight}`,
  ];

  for (const g of glyphs) {
    lines.push(
      `Glyph ${g.charOrUnicode} Width ${g.widthCol1} ${g.widthCol2} ${g.widthCol3} ${g.x1} ${g.y1} ${g.x2} ${g.y2} ${g.page}`
    );
  }

  lines.push("END");
  return lines.join("\n");
}
