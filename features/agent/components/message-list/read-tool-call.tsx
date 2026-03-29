import { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ToolCallInfo } from "../../types";
import { getToolStatusLabel, isToolCallActive, parseToolArguments } from "./tool-call-utils";
import { useIsMessageVisible } from "./visibility-context";
import { basename, countLines, sharedStyles as styles } from "./tool-call-shared";
import {
  CodePreview,
  buildCodeRows,
  editStyles,
  parseReadOutput,
  toolMetaStyles,
} from "./code-preview";
import { useExpandAnimation } from "./use-expand-animation";
import { AnimatedChevron } from "./animated-chevron";
import { ExpandableContent } from "./expandable-content";

export function ReadToolCall({ tc }: { tc: ToolCallInfo }) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const isRunning = isToolCallActive(tc);
  const isVisible = useIsMessageVisible();
  const statusLabel = getToolStatusLabel(tc);

  const anim = useExpandAnimation();

  useEffect(() => {
    if (isRunning && !anim.expanded) anim.expand();
  }, [isRunning, anim.expanded, anim.expand]);

  const parsed = parseToolArguments(tc.arguments);
  const path = parsed.path ?? "";
  const fileName = basename(path);
  const output = tc.result ?? "";
  const parsedOutput = useMemo(() => parseReadOutput(output), [output]);
  const startLine = (parsed.offset ?? 0) + 1;
  const shouldRenderPreview = anim.expanded && isVisible;
  const rows = useMemo(
    () => (shouldRenderPreview ? buildCodeRows(parsedOutput.body, startLine) : []),
    [parsedOutput.body, shouldRenderPreview, startLine],
  );

  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";
  const mutedColor = isDark ? "#888" : "#888";
  const boxBg = isDark ? "#0D0D0D" : "#FAFAFA";
  const boxBorder = isDark ? "#2A2A2A" : "#E8E8E8";
  const toolbarBg = isDark ? "#161616" : "#F3F3F3";
  const toolbarBorder = isDark ? "#2A2A2A" : "#E0E0E0";
  const lineNoBg = isDark ? "#111111" : "#F3F3F3";
  const lineNoColor = isDark ? "#444" : "#BBBBBB";

  const lineRange =
    parsedOutput.body.length > 0
      ? `${startLine}-${startLine + countLines(parsedOutput.body) - 1}`
      : null;

  return (
    <View>
      <Pressable style={styles.row} onPress={anim.toggle}>
        <Text style={styles.singleLine} numberOfLines={1}>
          <Text style={[styles.verb, { color: textColor }]}>Read</Text>
          <Text style={[styles.detail, { color: mutedColor }]}> {fileName}</Text>
          {lineRange ? (
            <Text style={[styles.status, { color: mutedColor }]}> lines {lineRange}</Text>
          ) : null}
          {statusLabel ? (
            <Text style={[styles.status, { color: mutedColor }]}> {statusLabel}</Text>
          ) : null}
        </Text>
        <AnimatedChevron style={anim.chevronStyle} color={mutedColor} />
      </Pressable>

      <ExpandableContent
        shouldRender={anim.shouldRender}
        containerStyle={anim.containerStyle}
        onMeasure={anim.onMeasure}
      >
        {(rows.length > 0 || isRunning || !!output) ? (
          <View style={[editStyles.box, { backgroundColor: boxBg, borderColor: boxBorder }]}>
            <View
              style={[editStyles.toolbar, { backgroundColor: toolbarBg, borderBottomColor: toolbarBorder }]}
            >
              <Text style={[editStyles.toolbarPath, { color: mutedColor }]} numberOfLines={1}>
                {path}
              </Text>
              <View style={toolMetaStyles.row}>
                {parsed.limit != null ? (
                  <Text style={[toolMetaStyles.text, { color: mutedColor }]}>
                    {parsed.limit} lines
                  </Text>
                ) : null}
                {lineRange ? (
                  <Text style={[toolMetaStyles.text, { color: mutedColor }]}>
                    {lineRange}
                  </Text>
                ) : null}
              </View>
            </View>

            {rows.length > 0 ? (
              <CodePreview rows={rows} isDark={isDark} lineNoBg={lineNoBg} lineNoColor={lineNoColor} />
            ) : (
              <View style={editStyles.pendingState}>
                <Text style={[editStyles.pendingText, { color: mutedColor }]}>
                  {tc.isError ? output : statusLabel ?? "Waiting for file contents..."}
                </Text>
              </View>
            )}

            {parsedOutput.remainingLines != null && parsedOutput.nextOffset != null ? (
              <View style={toolMetaStyles.footer}>
                <Text style={[toolMetaStyles.text, { color: mutedColor }]}>
                  {parsedOutput.remainingLines} more lines available at offset {parsedOutput.nextOffset}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ExpandableContent>
    </View>
  );
}
