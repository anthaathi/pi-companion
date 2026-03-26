import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Fonts } from "@/constants/theme";

const DEFAULT_DARK_TEXT = "#CCCCCC";
const DEFAULT_LIGHT_TEXT = "#1A1A1A";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffOp = { type: "equal" | "insert" | "delete"; lines: string[] };

export interface SideBySideRow {
  leftLineNo: number | null;
  leftText: string | null;
  leftType: "removed" | "context" | "empty";
  rightLineNo: number | null;
  rightText: string | null;
  rightType: "added" | "context" | "empty";
}

export interface InlineRow {
  type: "context" | "added" | "removed";
  text: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

interface Token { text: string; color: string }

export interface CodeRow {
  lineNo: number;
  text: string;
}

export interface ParsedReadOutput {
  body: string;
  nextOffset?: number;
  remainingLines?: number;
}

// ---------------------------------------------------------------------------
// Diff algorithm
// ---------------------------------------------------------------------------

const LCS_MAX_LINES = 100;

export function lcsLineDiff(oldText: string, newText: string): DiffOp[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  // For very large inputs, diff only the last N lines to avoid O(n*m) cost.
  // The tail is most relevant since edits happen at the end of context.
  if (n > LCS_MAX_LINES || m > LCS_MAX_LINES) {
    const aSlice = a.slice(-LCS_MAX_LINES);
    const bSlice = b.slice(-LCS_MAX_LINES);
    const skippedA = n - aSlice.length;
    const skippedB = m - bSlice.length;
    const tailOps = lcsLineDiff(aSlice.join("\n"), bSlice.join("\n"));
    const result: DiffOp[] = [];
    if (skippedA > 0 || skippedB > 0) {
      const skipped = Math.max(skippedA, skippedB);
      result.push({ type: "equal", lines: [`… ${skipped} lines not shown`] });
    }
    result.push(...tailOps);
    return result;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0, j = 0;

  const push = (type: DiffOp["type"], line: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) {
      last.lines.push(line);
    } else {
      ops.push({ type, lines: [line] });
    }
  };

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++; j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      push("delete", a[i]);
      i++;
    } else {
      push("insert", b[j]);
      j++;
    }
  }
  while (i < n) { push("delete", a[i]); i++; }
  while (j < m) { push("insert", b[j]); j++; }

  return ops;
}

export function buildSideBySide(ops: DiffOp[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.type === "equal") {
      for (const line of op.lines) {
        rows.push({
          leftLineNo: oldLine++, leftText: line, leftType: "context",
          rightLineNo: newLine++, rightText: line, rightType: "context",
        });
      }
    } else if (op.type === "delete") {
      const next = ops[i + 1];
      if (next && next.type === "insert") {
        const maxLen = Math.max(op.lines.length, next.lines.length);
        for (let k = 0; k < maxLen; k++) {
          const hasOld = k < op.lines.length;
          const hasNew = k < next.lines.length;
          rows.push({
            leftLineNo: hasOld ? oldLine++ : null,
            leftText: hasOld ? op.lines[k] : null,
            leftType: hasOld ? "removed" : "empty",
            rightLineNo: hasNew ? newLine++ : null,
            rightText: hasNew ? next.lines[k] : null,
            rightType: hasNew ? "added" : "empty",
          });
        }
        i++;
      } else {
        for (const line of op.lines) {
          rows.push({
            leftLineNo: oldLine++, leftText: line, leftType: "removed",
            rightLineNo: null, rightText: null, rightType: "empty",
          });
        }
      }
    } else {
      for (const line of op.lines) {
        rows.push({
          leftLineNo: null, leftText: null, leftType: "empty",
          rightLineNo: newLine++, rightText: line, rightType: "added",
        });
      }
    }
  }
  return rows;
}

export function buildInline(ops: DiffOp[]): InlineRow[] {
  const rows: InlineRow[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const op of ops) {
    if (op.type === "equal") {
      for (const line of op.lines) {
        rows.push({ type: "context", text: line, oldLineNo: oldLine++, newLineNo: newLine++ });
      }
    } else if (op.type === "delete") {
      for (const line of op.lines) {
        rows.push({ type: "removed", text: line, oldLineNo: oldLine++, newLineNo: null });
      }
    } else {
      for (const line of op.lines) {
        rows.push({ type: "added", text: line, oldLineNo: null, newLineNo: newLine++ });
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Syntax highlighting
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  "import", "export", "from", "default", "const", "let", "var", "function",
  "return", "if", "else", "for", "while", "do", "switch", "case", "break",
  "continue", "new", "this", "class", "extends", "super", "typeof", "instanceof",
  "void", "delete", "throw", "try", "catch", "finally", "async", "await",
  "yield", "in", "of", "true", "false", "null", "undefined", "type",
  "interface", "enum", "implements", "abstract", "as", "is", "readonly",
  "static", "private", "protected", "public", "def", "self", "None", "True",
  "False", "elif", "except", "raise", "with", "lambda", "pass", "and", "or",
  "not", "struct", "impl", "fn", "pub", "mut", "use", "mod", "crate",
]);

const DARK_COLORS = {
  keyword: "#C586C0", string: "#CE9178", number: "#B5CEA8",
  comment: "#6A9955", type: "#4EC9B0", func: "#DCDCAA",
  punct: "#808080", plain: "#9CDCFE",
};
const LIGHT_COLORS = {
  keyword: "#AF00DB", string: "#A31515", number: "#098658",
  comment: "#008000", type: "#267F99", func: "#795E26",
  punct: "#999999", plain: "#333333",
};

function tokenizeLine(line: string, isDark: boolean): Token[] {
  const c = isDark ? DARK_COLORS : LIGHT_COLORS;

  const tokens: Token[] = [];
  const re = /\/\/.*|\/\*[\s\S]*?\*\/|#.*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+\.?\d*(?:e[+-]?\d+)?\b|\b0x[0-9a-fA-F]+\b|[A-Z][a-zA-Z0-9_]*|[a-zA-Z_]\w*(?=\s*\()|[a-zA-Z_]\w*|[{}()\[\];:,.<>!=+\-*/%&|^~?@]|[ \t]+|\S/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const t = match[0];
    if (t.startsWith("//") || t.startsWith("#") || t.startsWith("/*")) {
      tokens.push({ text: t, color: c.comment });
    } else if (/^["'`]/.test(t) || t.startsWith('"""') || t.startsWith("'''")) {
      tokens.push({ text: t, color: c.string });
    } else if (/^\d/.test(t) || /^0x/i.test(t)) {
      tokens.push({ text: t, color: c.number });
    } else if (KEYWORDS.has(t)) {
      tokens.push({ text: t, color: c.keyword });
    } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(t)) {
      tokens.push({ text: t, color: c.type });
    } else if (/^[a-zA-Z_]\w*$/.test(t) && line[match.index + t.length] === "(") {
      tokens.push({ text: t, color: c.func });
    } else if (/^[{}()\[\];:,.<>!=+\-*/%&|^~?@]$/.test(t)) {
      tokens.push({ text: t, color: c.punct });
    } else {
      tokens.push({ text: t, color: c.plain });
    }
  }

  if (tokens.length === 0) {
    tokens.push({ text: line, color: c.plain });
  }

  return tokens;
}

export function TokenizedText({ line, isDark, style }: { line: string; isDark: boolean; style?: StyleProp<TextStyle> }) {
  const tokens = useMemo(() => tokenizeLine(line, isDark), [line, isDark]);
  // Fast path: single token = no nesting needed
  if (tokens.length === 1) {
    return <Text style={[style, { color: tokens[0].color }]} selectable>{tokens[0].text}</Text>;
  }
  return (
    <Text style={style} selectable>
      {tokens.map((tok, i) => (
        <Text key={i} style={{ color: tok.color }}>{tok.text}</Text>
      ))}
    </Text>
  );
}

export function PlainCodeText({ line, color, style }: { line: string; color: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[style, { color }]} selectable>
      {line || " "}
    </Text>
  );
}

/**
 * Diff for edit/search-replace previews.
 *
 * Unlike the old implementation, this keeps unchanged prefix/suffix lines as
 * context so only the actually changed lines are shown as removed/added.
 */
export function simpleDiff(oldText: string, newText: string): DiffOp[] {
  if (!oldText && !newText) return [];
  if (oldText === newText) {
    return oldText ? [{ type: "equal", lines: oldText.split("\n") }] : [];
  }

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  let start = 0;
  while (
    start < oldLines.length &&
    start < newLines.length &&
    oldLines[start] === newLines[start]
  ) {
    start += 1;
  }

  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (
    oldEnd >= start &&
    newEnd >= start &&
    oldLines[oldEnd] === newLines[newEnd]
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  const ops: DiffOp[] = [];

  if (start > 0) {
    ops.push({ type: "equal", lines: oldLines.slice(0, start) });
  }

  const oldMiddle = oldLines.slice(start, oldEnd + 1);
  const newMiddle = newLines.slice(start, newEnd + 1);

  if (oldMiddle.length > 0 || newMiddle.length > 0) {
    if (oldMiddle.length === 0) {
      ops.push({ type: "insert", lines: newMiddle });
    } else if (newMiddle.length === 0) {
      ops.push({ type: "delete", lines: oldMiddle });
    } else {
      ops.push(...lcsLineDiff(oldMiddle.join("\n"), newMiddle.join("\n")));
    }
  }

  if (oldEnd < oldLines.length - 1) {
    ops.push({ type: "equal", lines: oldLines.slice(oldEnd + 1) });
  }

  return ops.filter((op) => op.lines.length > 0);
}

/** Max lines to render before showing "Show all" */
export const MAX_DIFF_LINES = 80;

// ---------------------------------------------------------------------------
// Read output parsing
// ---------------------------------------------------------------------------

const READ_MORE_PATTERN =
  /\n?\[(\d+) more lines in file\. Use offset=(\d+) to continue\.\]\s*$/;

export function buildCodeRows(text: string, startLine: number): CodeRow[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  return lines.map((line, index) => ({
    lineNo: startLine + index,
    text: line,
  }));
}

export function parseReadOutput(text: string): ParsedReadOutput {
  const match = text.match(READ_MORE_PATTERN);
  if (!match || match.index == null) {
    return { body: text };
  }
  return {
    body: text.slice(0, match.index).replace(/\n+$/, ""),
    remainingLines: Number.parseInt(match[1] ?? "", 10),
    nextOffset: Number.parseInt(match[2] ?? "", 10),
  };
}

export function isResolvableFilePath(path: string): boolean {
  return path.startsWith("/") || path.startsWith("~");
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function CodePreview({
  rows,
  isDark,
  lineNoBg,
  lineNoColor,
  rowBackgroundColor,
  scrollStyle,
}: {
  rows: CodeRow[];
  isDark: boolean;
  lineNoBg: string;
  lineNoColor: string;
  rowBackgroundColor?: string;
  scrollStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView style={scrollStyle ?? editStyles.scrollV} nestedScrollEnabled>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={codeTableStyles.table}>
          {rows.map((row) => (
            <View
              key={`${row.lineNo}-${row.text}`}
              style={[
                codeTableStyles.row,
                rowBackgroundColor ? { backgroundColor: rowBackgroundColor } : undefined,
              ]}
            >
              <View style={[codeTableStyles.lineNoCol, { backgroundColor: lineNoBg }]}>
                <Text style={[editStyles.lineNo, { color: lineNoColor }]}>
                  {row.lineNo}
                </Text>
              </View>
              <TokenizedText
                line={row.text}
                isDark={isDark}
                style={editStyles.lineText}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

export function SplitDiffView({
  rows,
  containerWidth,
  isDark,
  removeBg,
  addBg,
  emptyBg,
  lineNoBg,
  lineNoColor,
  dividerColor,
  contextTextColor,
  addTextColor,
  removeTextColor,
}: {
  rows: SideBySideRow[];
  containerWidth: number;
  isDark: boolean;
  removeBg: string;
  addBg: string;
  emptyBg: string;
  lineNoBg: string;
  lineNoColor: string;
  dividerColor: string;
  contextTextColor?: string;
  addTextColor?: string;
  removeTextColor?: string;
}) {
  const halfW = Math.max(200, Math.floor((containerWidth - 1) / 2));
  const baseTextColor = contextTextColor ?? (isDark ? DEFAULT_DARK_TEXT : DEFAULT_LIGHT_TEXT);
  const addedColor = addTextColor ?? baseTextColor;
  const removedColor = removeTextColor ?? baseTextColor;
  return (
    <View style={[editStyles.table, { width: halfW * 2 + 1 }]}>
      {rows.map((row, i) => (
        <View key={i} style={editStyles.tableRow}>
          <View style={[
            editStyles.half,
            { width: halfW },
            row.leftType === "removed" ? { backgroundColor: removeBg } :
            row.leftType === "empty" ? { backgroundColor: emptyBg } : undefined,
          ]}>
            <View style={[editStyles.lineNoCol, { backgroundColor: lineNoBg }]}>
              <Text style={[editStyles.lineNo, { color: lineNoColor }]}>
                {row.leftLineNo ?? ""}
              </Text>
            </View>
            {row.leftText != null ? (
              <PlainCodeText
                line={row.leftText}
                color={row.leftType === "removed" ? removedColor : baseTextColor}
                style={editStyles.lineText}
              />
            ) : (
              <Text style={editStyles.lineText}>{" "}</Text>
            )}
          </View>
          <View style={[editStyles.divider, { backgroundColor: dividerColor }]} />
          <View style={[
            editStyles.half,
            { width: halfW },
            row.rightType === "added" ? { backgroundColor: addBg } :
            row.rightType === "empty" ? { backgroundColor: emptyBg } : undefined,
          ]}>
            <View style={[editStyles.lineNoCol, { backgroundColor: lineNoBg }]}>
              <Text style={[editStyles.lineNo, { color: lineNoColor }]}>
                {row.rightLineNo ?? ""}
              </Text>
            </View>
            {row.rightText != null ? (
              <PlainCodeText
                line={row.rightText}
                color={row.rightType === "added" ? addedColor : baseTextColor}
                style={editStyles.lineText}
              />
            ) : (
              <Text style={editStyles.lineText}>{" "}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const editStyles = StyleSheet.create({
  box: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 0.633,
  },
  toolbarPath: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    flex: 1,
    marginRight: 8,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
    gap: 2,
  },
  viewToggleBtn: {
    width: 24,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollV: {
    maxHeight: 400,
  },
  pendingState: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  pendingText: {
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  table: {
    minWidth: "100%",
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 22,
  },
  half: {
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  divider: {
    width: 1,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 22,
  },
  prefix: {
    width: 16,
    fontSize: 12,
    fontFamily: Fonts.mono,
    lineHeight: 22,
    textAlign: "center",
  },
  lineNoCol: {
    width: 32,
    paddingHorizontal: 4,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  lineNo: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    lineHeight: 22,
  },
  lineText: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    lineHeight: 22,
    paddingHorizontal: 8,
    flex: 1,
  },
});

const codeTableStyles = StyleSheet.create({
  table: {
    minWidth: "100%",
  },
  row: {
    flexDirection: "row",
    minHeight: 22,
  },
  lineNoCol: {
    width: 56,
    paddingHorizontal: 6,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});

export const toolMetaStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(127,127,127,0.2)",
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(127,127,127,0.2)",
  },
  text: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
});
