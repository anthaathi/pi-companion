import Svg, { Circle, Path } from "react-native-svg";

interface AnthaathiLogoProps {
  size?: number;
  isDark?: boolean;
}

export function AnthaathiLogo({ size = 48, isDark = false }: AnthaathiLogoProps) {
  const strokeColor = isDark ? "#e0e0e0" : "#1A1A1A";
  const dotColor = isDark ? "#e0e0e0" : "#0F0F0F";

  return (
    <Svg width={size} height={size} viewBox="12 10 78 80">
      <Circle cx="50" cy="50" r="16" fill="#D71921" />
      <Path
        d="M 28 28 A 32 32 0 0 1 50 18"
        fill="none"
        stroke={strokeColor}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Path
        d="M 72 28 A 32 32 0 0 1 72 72"
        fill="none"
        stroke={strokeColor}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Path
        d="M 50 82 A 32 32 0 0 1 28 72"
        fill="none"
        stroke={strokeColor}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Circle cx="18" cy="50" r="4" fill={dotColor} />
    </Svg>
  );
}
