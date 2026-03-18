import Svg, { Path } from 'react-native-svg';

interface PiLogoProps {
  size?: number;
  color?: string;
}

export function PiLogo({ size = 24, color = '#fff' }: PiLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 800 800">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"
      />
      <Path
        fill={color}
        d="M517.36 400H634.72V634.72H517.36Z"
      />
    </Svg>
  );
}
