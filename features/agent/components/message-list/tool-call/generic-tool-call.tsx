import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import type { ToolCallInfo } from "../../../types";
import { toolDisplayName, isToolActive } from "../utils";
import { AnimatedCollapse } from "../animated-collapse";
import { ToolResultImages } from "./tool-result-images";

interface GenericToolCallProps {
  tc: ToolCallInfo;
  isDark: boolean;
  turnCompleted?: boolean;
}

export const GenericToolCall = memo(function GenericToolCall({
  tc,
  isDark,
  turnCompleted = false,
}: GenericToolCallProps) {
  const colors = isDark ? Colors.dark : Colors.light;
  const active = isToolActive(tc);
  const [expanded, setExpanded] = useState(() => active || (!turnCompleted && tc.status === "complete"));
  const toggle = useCallback(() => setExpanded((p) => !p), []);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  const prevTurnCompleted = useRef(turnCompleted);
  useEffect(() => {
    const justCompleted = turnCompleted && !prevTurnCompleted.current;
    prevTurnCompleted.current = turnCompleted;
    if (justCompleted && !active) {
      const timer = setTimeout(() => setExpanded(false), 400);
      return () => clearTimeout(timer);
    }
  }, [turnCompleted, active]);

  const hasImages = !!(tc.resultImages && tc.resultImages.length > 0);
  const hasResult = !!tc.result || !!tc.partialResult;
  const hasContent = hasResult || hasImages;
  const resultText = tc.result || tc.partialResult || "";

  return (
    <View>
      <Pressable onPress={hasContent ? toggle : undefined} style={styles.header}>
        <Text style={[styles.name, { color: colors.textSecondary }]}>
          {toolDisplayName(tc.name)}
        </Text>
      </Pressable>
      {hasImages && <ToolResultImages images={tc.resultImages!} isDark={isDark} />}
      <AnimatedCollapse expanded={expanded && hasResult} maxHeight={350}>
        <View style={[styles.resultBox, { backgroundColor: colors.surfaceRaised }]}>
          <Text
            style={[styles.resultText, { color: colors.textSecondary }]}
            numberOfLines={20}
            selectable
          >
            {resultText}
          </Text>
        </View>
      </AnimatedCollapse>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  name: {
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
    fontWeight: "500",
  },
  resultBox: {
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    marginLeft: 12,
  },
  resultText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Fonts.mono,
  },
});
