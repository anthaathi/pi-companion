import { Pressable, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import type { Tab } from "./constants";
import { useChangesTheme } from "./use-theme-colors";

const TAB_DEFINITIONS: Array<[Tab, (count: number) => string]> = [
  ["changes", (n) => `${n} Changes`],
  ["files", () => "Files"],
  ["history", () => "Log"],
];

export function TabBar({
  activeTab,
  onTabChange,
  totalChanges,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  totalChanges: number;
}) {
  const {
    colors,
    surfaceBg,
    tabContainerBg,
    tabActiveBg,
    tabBorder,
    dividerColor,
  } = useChangesTheme();

  return (
    <View
      style={[
        styles.tabBar,
        { backgroundColor: surfaceBg, borderBottomColor: dividerColor },
      ]}
    >
      <View
        style={[
          styles.tabGroup,
          { backgroundColor: tabContainerBg, borderColor: tabBorder },
        ]}
      >
        {TAB_DEFINITIONS.map(([key, labelFn]) => (
          <Pressable
            key={key}
            style={[
              styles.tab,
              activeTab === key && { backgroundColor: tabActiveBg },
            ]}
            onPress={() => onTabChange(key)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === key ? colors.text : colors.textTertiary,
                },
              ]}
            >
              {labelFn(totalChanges)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 48,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderBottomWidth: 0.633,
  },
  tabGroup: {
    flexDirection: "row",
    borderRadius: 6,
    borderWidth: 0.633,
    padding: 0.633,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 5,
  },
  tabText: {
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
  },
});
