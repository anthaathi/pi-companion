import { useRef, useEffect, useMemo } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { GitBranch } from "lucide-react-native";

import { Colors, Fonts } from "@/constants/theme";
import { AnthaathiLogo } from "@/components/anthaathi-logo";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useGitStatus } from "@/features/workspace/hooks/use-git-status";

const GREETINGS = [
  "What are we building?",
  "Ready when you are",
  "How can I help?",
  "Ask me anything",
  "What's on your mind?",
  "Let's ship something",
  "What needs fixing?",
  "Where were we?",
  "Let's figure it out",
  "What's the plan?",
  "Think it. Build it.",
  "Ideas welcome",
  "Your move",
  "What's next?",
  "Let's make progress",
  "Describe, and I'll build",
  "Say the word",
  "At your service",
  "Waiting for orders",
  "Fire away",
  "The most personal is the most creative.",
];

const TIME_GREETINGS: { start: number; end: number; messages: string[] }[] = [
  {
    start: 5,
    end: 12,
    messages: [
      "Good morning, let's build",
      "Fresh morning, fresh code",
      "Early start, let's go",
    ],
  },
  {
    start: 12,
    end: 17,
    messages: [
      "Good afternoon, what's up?",
      "Afternoon focus mode",
      "Post-lunch productivity?",
    ],
  },
  {
    start: 17,
    end: 21,
    messages: [
      "Good evening, still at it?",
      "Evening session, let's go",
      "Winding down or ramping up?",
    ],
  },
  {
    start: 21,
    end: 5,
    messages: [
      "Late night hacking?",
      "Burning the midnight oil",
      "Night owl mode activated",
    ],
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  const useTimeBased = Math.random() < 0.35;

  if (useTimeBased) {
    const slot = TIME_GREETINGS.find((s) =>
      s.start < s.end
        ? hour >= s.start && hour < s.end
        : hour >= s.start || hour < s.end,
    );
    if (slot) {
      return slot.messages[Math.floor(Math.random() * slot.messages.length)];
    }
  }

  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

export function WorkspaceHero() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const isDark = colorScheme === "dark";
  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;

  const greeting = useMemo(() => getGreeting(), []);

  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === selectedWorkspaceId),
  );

  const cwd = workspace?.path ?? null;
  const { data: gitData } = useGitStatus(cwd);

  const workspacePath = workspace?.path ?? "";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <AnthaathiLogo size={48} isDark={isDark} />

        <Text style={[styles.title, { color: textPrimary }]}>{greeting}</Text>

        {/* Meta info */}
        <View style={styles.metaContainer}>
          <Text style={[styles.metaText, { color: textMuted }]}>
            {workspacePath}
          </Text>

          {gitData?.branch && (
            <View style={styles.branchRow}>
              <GitBranch size={14} color={textMuted} strokeWidth={2} />
              <Text style={[styles.metaText, { color: textMuted }]}>
                {gitData.branch}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.sansMedium,
    lineHeight: 36,
  },
  metaContainer: {
    alignItems: "center",
    gap: 16,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
    lineHeight: 19.5,
  },
});
