const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_MAP: Record<string, number> = {};
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_MAP[BASE64_CHARS[i]] = i;
}

export function encodeVLQ(value: number): string {
  let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let encoded = '';
  do {
    let digit = vlq & 0x1f;
    vlq >>>= 5;
    if (vlq > 0) digit |= 0x20;
    encoded += BASE64_CHARS[digit];
  } while (vlq > 0);
  return encoded;
}

export function decodeVLQ(str: string, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let i = offset;
  let digit: number;
  do {
    if (i >= str.length) throw new Error('Unexpected end of VLQ');
    digit = BASE64_MAP[str[i]];
    if (digit === undefined) throw new Error(`Invalid base64 character: ${str[i]}`);
    result += (digit & 0x1f) << shift;
    shift += 5;
    i++;
  } while (digit & 0x20);
  const isNegative = result & 1;
  result >>= 1;
  return [isNegative ? -result : result, i];
}

export interface SourceMapSegment {
  generatedLine: number;
  generatedColumn: number;
  sourceIndex: number;
  originalLine: number;
  originalColumn: number;
  namesIndex?: number;
}

export function decodeSourceMapMappings(mappings: string): SourceMapSegment[] {
  const segments: SourceMapSegment[] = [];
  let generatedLine = 0;
  let generatedColumn = 0;
  let sourceIndex = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let namesIndex = 0;

  for (const line of mappings.split(';')) {
    generatedColumn = 0;
    if (line.length === 0) {
      generatedLine++;
      continue;
    }
    let pos = 0;
    for (const seg of line.split(',')) {
      if (seg.length === 0) continue;
      const fields: number[] = [];
      let offset = 0;
      while (offset < seg.length) {
        const [value, newPos] = decodeVLQ(seg, offset);
        fields.push(value);
        offset = newPos;
      }
      generatedColumn += fields[0] || 0;
      const segment: SourceMapSegment = {
        generatedLine,
        generatedColumn,
        sourceIndex: 0,
        originalLine: 0,
        originalColumn: 0,
      };
      if (fields.length >= 4) {
        sourceIndex += fields[1];
        originalLine += fields[2];
        originalColumn += fields[3];
        segment.sourceIndex = sourceIndex;
        segment.originalLine = originalLine;
        segment.originalColumn = originalColumn;
      }
      if (fields.length >= 5) {
        namesIndex += fields[4];
        segment.namesIndex = namesIndex;
      }
      segments.push(segment);
    }
    generatedLine++;
  }
  return segments;
}

export function encodeSourceMapMappings(segments: SourceMapSegment[]): string {
  const lines: string[] = [];
  let prevLine = 0;
  let prevCol = 0;
  let prevSrc = 0;
  let prevOrigLine = 0;
  let prevOrigCol = 0;
  let prevName = 0;

  const sorted = [...segments].sort((a, b) =>
    a.generatedLine !== b.generatedLine
      ? a.generatedLine - b.generatedLine
      : a.generatedColumn - b.generatedColumn
  );

  let currentLine = 0;
  let lineSegments: string[] = [];

  for (const seg of sorted) {
    while (currentLine < seg.generatedLine) {
      lines.push(lineSegments.join(','));
      lineSegments = [];
      currentLine++;
      prevCol = 0;
    }
    const fields: number[] = [seg.generatedColumn - prevCol];
    const hasSource = seg.sourceIndex !== undefined;
    if (hasSource) {
      fields.push(seg.sourceIndex - prevSrc);
      fields.push(seg.originalLine - prevOrigLine);
      fields.push(seg.originalColumn - prevOrigCol);
      prevSrc = seg.sourceIndex;
      prevOrigLine = seg.originalLine;
      prevOrigCol = seg.originalColumn;
    }
    if (seg.namesIndex !== undefined) {
      fields.push(seg.namesIndex - prevName);
      prevName = seg.namesIndex;
    }
    prevCol = seg.generatedColumn;
    lineSegments.push(fields.map(f => encodeVLQ(f)).join(''));
  }

  if (lineSegments.length > 0) {
    lines.push(lineSegments.join(','));
  }
  while (currentLine < generatedLine_fromSegments(sorted)) {
    lines.push('');
    currentLine++;
  }

  return lines.join(';');
}

function generatedLine_fromSegments(segments: SourceMapSegment[]): number {
  if (segments.length === 0) return 0;
  return Math.max(...segments.map(s => s.generatedLine)) + 1;
}

export function mergeSourceMaps(parent: import('./types').SourceMap, child: import('./types').SourceMap): import('./types').SourceMap {
  const childSegments = decodeSourceMapMappings(child.mappings);
  const parentSegments = decodeSourceMapMappings(parent.mappings);

  const parentSegmentMap = new Map<string, SourceMapSegment>();
  for (const seg of parentSegments) {
    const key = `${seg.generatedLine}:${seg.generatedColumn}`;
    parentSegmentMap.set(key, seg);
  }

  const mergedSegments: SourceMapSegment[] = [];
  const sources: string[] = [];
  const sourceIndexMap = new Map<string, number>();
  const names: string[] = [];
  const nameIndexMap = new Map<string, number>();

  for (const childSeg of childSegments) {
    const childSource = child.sources[childSeg.sourceIndex] || '';
    const childOrigLine = childSeg.originalLine;
    const childOrigCol = childSeg.originalColumn;

    const parentKey = `${childOrigLine}:${childOrigCol}`;
    const parentSeg = parentSegmentMap.get(parentKey);

    if (parentSeg && childSource === (parent.file || '')) {
      const parentSource = parent.sources[parentSeg.sourceIndex] || '';
      if (!sourceIndexMap.has(parentSource)) {
        sourceIndexMap.set(parentSource, sources.length);
        sources.push(parentSource);
      }
      const si = sourceIndexMap.get(parentSource)!;
      let ni = 0;
      if (parentSeg.namesIndex !== undefined && parent.names[parentSeg.namesIndex]) {
        const name = parent.names[parentSeg.namesIndex];
        if (!nameIndexMap.has(name)) {
          nameIndexMap.set(name, names.length);
          names.push(name);
        }
        ni = nameIndexMap.get(name)!;
      }
      mergedSegments.push({
        generatedLine: childSeg.generatedLine,
        generatedColumn: childSeg.generatedColumn,
        sourceIndex: si,
        originalLine: parentSeg.originalLine,
        originalColumn: parentSeg.originalColumn,
        ...(parentSeg.namesIndex !== undefined ? { namesIndex: ni } : {}),
      });
    } else {
      if (!sourceIndexMap.has(childSource)) {
        sourceIndexMap.set(childSource, sources.length);
        sources.push(childSource);
      }
      mergedSegments.push({
        generatedLine: childSeg.generatedLine,
        generatedColumn: childSeg.generatedColumn,
        sourceIndex: sourceIndexMap.get(childSource)!,
        originalLine: childOrigLine,
        originalColumn: childOrigCol,
      });
    }
  }

  return {
    version: 3,
    sources,
    names,
    mappings: encodeSourceMapMappings(mergedSegments),
    sourcesContent: sources.map(s => {
      const ci = child.sources.indexOf(s);
      if (ci >= 0 && child.sourcesContent?.[ci]) return child.sourcesContent[ci];
      const pi = parent.sources.indexOf(s);
      if (pi >= 0 && parent.sourcesContent?.[pi]) return parent.sourcesContent[pi];
      return null;
    }),
  };
}

export function generateSourceMap(
  generatedCode: string,
  originalCode: string,
  originalFile: string,
  generatedFile?: string
): import('./types').SourceMap {
  const generatedLines = generatedCode.split('\n');
  const originalLines = originalCode.split('\n');
  const segments: SourceMapSegment[] = [];

  for (let genLine = 0; genLine < generatedLines.length; genLine++) {
    const origLine = Math.min(genLine, originalLines.length - 1);
    if (origLine >= 0) {
      segments.push({
        generatedLine: genLine,
        generatedColumn: 0,
        sourceIndex: 0,
        originalLine: origLine,
        originalColumn: 0,
      });
    }
  }

  return {
    version: 3,
    sources: [originalFile],
    names: [],
    mappings: encodeSourceMapMappings(segments),
    file: generatedFile,
    sourcesContent: [originalCode],
  };
}

export function appendSourceMapUrl(code: string, mapFileName: string): string {
  return code + `\n//# sourceMappingURL=${mapFileName}\n`;
}
