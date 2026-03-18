import type { TextStyle } from "react-native";
import { Fonts } from "@/constants/theme";

const headingSizes = [20, 18, 16, 15, 14, 14];
const headingLineHeights = [28, 26, 24, 22, 22, 22];
const headingFonts = [
  Fonts.sansBold,
  Fonts.sansBold,
  Fonts.sansSemiBold,
  Fonts.sansSemiBold,
  Fonts.sansSemiBold,
  Fonts.sansMedium,
];

function darkHeading(level: number): TextStyle {
  const i = Math.min(level - 1, 5);
  return {
    fontSize: headingSizes[i],
    lineHeight: headingLineHeights[i],
    fontFamily: headingFonts[i],
    fontWeight: level <= 2 ? "bold" : "600",
    color: "#E8E8E8",
    marginVertical: level <= 3 ? 4 : 2,
  };
}

function lightHeading(level: number): TextStyle {
  const i = Math.min(level - 1, 5);
  return {
    fontSize: headingSizes[i],
    lineHeight: headingLineHeights[i],
    fontFamily: headingFonts[i],
    fontWeight: level <= 2 ? "bold" : "600",
    color: "#1A1A1A",
    marginVertical: level <= 3 ? 4 : 2,
  };
}

export const markdownDarkStyles = {
  text: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: "#CCCCCC",
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.sans,
    color: "#CCCCCC",
  },
  heading: darkHeading,
  strong: {
    fontFamily: Fonts.sansBold,
    fontWeight: "bold" as const,
    color: "#E8E8E8",
  },
  emphasis: {
    fontFamily: Fonts.sansItalic,
    fontStyle: "italic" as const,
  },
  delete: {
    fontFamily: Fonts.sans,
    textDecorationLine: "line-through" as const,
    color: "#999999",
  },
  inlineCode: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: "#c9d1d9",
    backgroundColor: "#1A1A1A",
  },
  codeBlock: {
    contentBackgroundColor: "#1A1A1A",
    headerBackgroundColor: "#1A1A1A",
    contentTextStyle: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      lineHeight: 18,
      color: "#c9d1d9",
    },
    headerTextStyle: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: "#888",
    },
  },
  link: {
    fontFamily: Fonts.sans,
    color: "#58a6ff",
  },
  linkReference: {
    fontFamily: Fonts.sans,
    color: "#58a6ff",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#333333",
    paddingLeft: 12,
  },
  footnoteReference: {
    fontFamily: Fonts.sans,
    fontStyle: "italic" as const,
    fontSize: 10,
    color: "#888888",
  },
  borderColor: "#2A2A2A",
  container: {
    gap: 4,
  },
  list: {
    gap: 2,
  },
  listItem: {
    flex: 1,
    gap: 2,
  },
  tableCell: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: "#CCCCCC",
  },
  thematicBreak: {
    marginVertical: 8,
    height: 1,
    backgroundColor: "#2A2A2A",
  },
};

export const markdownLightStyles = {
  text: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: "#1A1A1A",
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.sans,
    color: "#1A1A1A",
  },
  heading: lightHeading,
  strong: {
    fontFamily: Fonts.sansBold,
    fontWeight: "bold" as const,
    color: "#111111",
  },
  emphasis: {
    fontFamily: Fonts.sansItalic,
    fontStyle: "italic" as const,
  },
  delete: {
    fontFamily: Fonts.sans,
    textDecorationLine: "line-through" as const,
    color: "#666666",
  },
  inlineCode: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: "#24292e",
    backgroundColor: "#F4F4F4",
  },
  codeBlock: {
    contentBackgroundColor: "#F6F6F6",
    headerBackgroundColor: "#F0F0F0",
    contentTextStyle: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      lineHeight: 18,
      color: "#24292e",
    },
    headerTextStyle: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: "#666",
    },
  },
  link: {
    fontFamily: Fonts.sans,
    color: "#0366d6",
  },
  linkReference: {
    fontFamily: Fonts.sans,
    color: "#0366d6",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#DDDDDD",
    paddingLeft: 12,
  },
  footnoteReference: {
    fontFamily: Fonts.sans,
    fontStyle: "italic" as const,
    fontSize: 10,
    color: "#666666",
  },
  borderColor: "#E8E8E8",
  container: {
    gap: 4,
  },
  list: {
    gap: 2,
  },
  listItem: {
    flex: 1,
    gap: 2,
  },
  tableCell: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: "#1A1A1A",
  },
  thematicBreak: {
    marginVertical: 8,
    height: 1,
    backgroundColor: "#E8E8E8",
  },
};
