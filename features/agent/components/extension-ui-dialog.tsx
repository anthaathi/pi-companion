import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Circle, CircleDot, X } from "lucide-react-native";

import { Fonts } from "@/constants/theme";
import { usePromptTheme } from "@/features/workspace/components/prompt-input/use-theme-colors";
import type { PendingExtensionUiRequest } from "../extension-ui";
import { useSendExtensionUiResponse } from "../hooks/use-agent-session";

function getRequestTitle(request: PendingExtensionUiRequest): string {
  if (request.title?.trim()) return request.title;

  switch (request.method) {
    case "select":
      return "Choose an Option";
    case "confirm":
      return "Confirm";
    case "input":
      return "Enter a Value";
    case "editor":
      return "Edit Text";
  }
}

function formatTimeout(timeout?: number): string | null {
  if (!timeout || timeout <= 0) return null;
  const seconds = Math.ceil(timeout / 1000);
  return `Waiting for a response${seconds > 0 ? ` (${seconds}s timeout)` : ""}`;
}

export function ExtensionUiDialog({
  sessionId,
  request,
}: {
  sessionId?: string | null;
  request?: PendingExtensionUiRequest | null;
}) {
  const theme = usePromptTheme();
  const mutation = useSendExtensionUiResponse();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!request) {
      setSelectedOption(null);
      setDraft("");
      return;
    }

    if (request.method === "select") {
      setSelectedOption(request.options[0] ?? null);
      setDraft("");
      return;
    }

    if (request.method === "editor") {
      setDraft(request.prefill ?? "");
      setSelectedOption(null);
      return;
    }

    if (request.method === "input") {
      setDraft(request.value ?? "");
      setSelectedOption(null);
      return;
    }

    setSelectedOption(null);
    setDraft("");
  }, [request]);

  const title = useMemo(
    () => (request ? getRequestTitle(request) : ""),
    [request],
  );
  const timeoutText = useMemo(
    () => (request ? formatTimeout(request.timeout) : null),
    [request],
  );

  if (!request || !sessionId) {
    return null;
  }

  const submit = (payload: {
    value?: unknown;
    confirmed?: boolean;
    cancelled?: boolean;
  }) => {
    if (mutation.isPending) return;
    mutation.mutate({
      sessionId,
      id: request.id,
      ...payload,
    });
  };

  const handleCancel = () => submit({ cancelled: true });
  const canSubmitSelect =
    request.method !== "select" || selectedOption !== null;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.dropdownBg,
            borderColor: theme.dropdownBorder,
          },
        ]}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.dropdownBorder },
          ]}
        >
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {title}
            </Text>
            {request.message ? (
              <Text style={[styles.message, { color: theme.textMuted }]}>
                {request.message}
              </Text>
            ) : null}
            {timeoutText ? (
              <Text style={[styles.timeout, { color: theme.sectionColor }]}>
                {timeoutText}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={handleCancel}
            disabled={mutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Dismiss question"
            style={({ pressed, hovered }: any) => [
              styles.dismissButton,
              (pressed || hovered) && { backgroundColor: theme.hoverBg },
            ]}
          >
            <X size={16} color={theme.textMuted} strokeWidth={1.8} />
          </Pressable>
        </View>

        {request.method === "select" && (
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {request.options.map((option) => {
              const isSelected = selectedOption === option;
              return (
                <Pressable
                  key={`${request.id}-${option}`}
                  onPress={() => setSelectedOption(option)}
                  style={({ pressed, hovered }: any) => [
                    styles.optionRow,
                    isSelected && { backgroundColor: theme.selectedBg },
                    (pressed || hovered) &&
                      !isSelected && { backgroundColor: theme.hoverBg },
                  ]}
                >
                  {isSelected ? (
                    <CircleDot
                      size={16}
                      color={theme.accentColor}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Circle
                      size={16}
                      color={theme.textMuted}
                      strokeWidth={1.8}
                    />
                  )}
                  <Text style={[styles.optionText, { color: theme.textPrimary }]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {request.method === "confirm" && (
          <View style={styles.actionArea}>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => submit({ confirmed: false })}
                disabled={mutation.isPending}
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.toolbarBorder },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.textPrimary },
                  ]}
                >
                  No
                </Text>
              </Pressable>
              <Pressable
                onPress={() => submit({ confirmed: true })}
                disabled={mutation.isPending}
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.colors.text },
                ]}
              >
                <Check
                  size={14}
                  color={theme.colors.background}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: theme.colors.background },
                  ]}
                >
                  Yes
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {request.method === "input" && (
          <View style={styles.actionArea}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={request.placeholder ?? "Type your response"}
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
              autoFocus
              autoCorrect={false}
              editable={!mutation.isPending}
              returnKeyType="done"
              onSubmitEditing={() => submit({ value: draft })}
            />
          </View>
        )}

        {request.method === "editor" && (
          <View style={styles.actionArea}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Edit the text"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.editor,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
              autoFocus
              multiline
              textAlignVertical="top"
              editable={!mutation.isPending}
            />
          </View>
        )}

        {request.method !== "confirm" && (
          <View
            style={[
              styles.footer,
              { borderTopColor: theme.dropdownBorder },
            ]}
          >
            <Pressable
              onPress={handleCancel}
              disabled={mutation.isPending}
              style={[
                styles.secondaryButton,
                { borderColor: theme.toolbarBorder },
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.textPrimary },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                submit({
                  value: request.method === "select" ? selectedOption : draft,
                })
              }
              disabled={mutation.isPending || !canSubmitSelect}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.colors.text,
                  opacity:
                    mutation.isPending || !canSubmitSelect ? 0.45 : 1,
                },
              ]}
            >
              {mutation.isPending ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.background}
                />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: theme.colors.background },
                  ]}
                >
                  Submit
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {mutation.isError && (
          <View style={styles.errorWrap}>
            <Text style={[styles.errorText, { color: theme.colors.destructive }]}>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to send the response"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    maxWidth: 1080,
    alignSelf: "center",
    width: "100%",
    overflow: "visible",
  },
  container: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 0.633,
    borderBottomWidth: 0,
    overflow: "hidden",
    zIndex: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.633,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sansMedium,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  timeout: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Fonts.sans,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    maxHeight: 260,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 40,
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  actionArea: {
    padding: 12,
  },
  input: {
    minHeight: 44,
    borderWidth: 0.633,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  editor: {
    minHeight: 180,
    borderWidth: 0.633,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.mono,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 0.633,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 36,
    borderWidth: 0.633,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
  primaryButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
  errorWrap: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.sans,
  },
});
