import { STEEL_COLOR_LIGHT, STEEL_COLOR_DARK } from '../constants';

export const FermenterIcon = ({ fillPercentage = 0 }) => {
  const fillHeight = 90 * (Math.min(100, Math.max(0, fillPercentage)) / 100);
  return (
  <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
      <defs>
          <linearGradient id="fermenterBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: STEEL_COLOR_LIGHT}} /><stop offset="50%" style={{stopColor: STEEL_COLOR_DARK}} /><stop offset="100%" style={{stopColor: STEEL_COLOR_LIGHT}} />
          </linearGradient>
          <clipPath id="fermenterClip">
              <path d="M 10 10 H 90 V 100 L 50 115 L 10 100 V 10 Z" />
          </clipPath>
      </defs>
      <path d="M 10 10 H 90 V 100 L 50 115 L 10 100 V 10 Z" fill="url(#fermenterBodyGradient)" stroke={STEEL_COLOR_DARK} strokeWidth="2"/>
      {fillHeight > 0 && <rect x="10" y={100 - fillHeight} width="80" height={fillHeight + 15} fill="rgba(210, 180, 140, 0.8)" clipPath="url(#fermenterClip)"/>}
      <rect x="8" y="8" width="84" height="10" fill={STEEL_COLOR_DARK} rx="2" />
      <path d="M 20 115 V 120" stroke={STEEL_COLOR_DARK} strokeWidth="4" /><path d="M 80 115 V 120" stroke={STEEL_COLOR_DARK} strokeWidth="4" />
      <path d="M 50 115 V 120" stroke={STEEL_COLOR_DARK} strokeWidth="4" />
  </svg>
  );
};