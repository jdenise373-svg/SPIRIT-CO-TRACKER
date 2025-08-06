import { LIQUID_FILL_COLOR, STEEL_COLOR_LIGHT, STEEL_COLOR_DARK } from '../constants';

export const MetalDrumIcon = ({ fillSvgHeight = 0 }) => (
  <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
      <defs><linearGradient id="drumBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: STEEL_COLOR_LIGHT}} /><stop offset="20%" style={{stopColor: STEEL_COLOR_DARK}} /><stop offset="50%" style={{stopColor: STEEL_COLOR_LIGHT}} /><stop offset="80%" style={{stopColor: STEEL_COLOR_DARK}} /><stop offset="100%" style={{stopColor: STEEL_COLOR_LIGHT}} /></linearGradient><clipPath id="drumClip"><rect x="10" y="10" width="80" height="100" rx="8" ry="8"/></clipPath></defs>
      <rect x="10" y="10" width="80" height="100" rx="8" ry="8" fill="url(#drumBodyGradient)"/>
      {fillSvgHeight > 0 && <rect x="10" y={110 - fillSvgHeight} width="80" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#drumClip)" rx="8" ry="8"/>}
      <rect x="8" y="30" width="84" height="8" rx="4" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="0.5"/>
      <rect x="8" y="55" width="84" height="8" rx="4" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="0.5"/>
      <rect x="8" y="80" width="84" height="8" rx="4" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="0.5"/>
      <ellipse cx="50" cy="11" rx="42" ry="6" fill={STEEL_COLOR_LIGHT} stroke="#707070" strokeWidth="1"/>
      <ellipse cx="50" cy="109" rx="42" ry="6" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="1"/>
      <circle cx="35" cy="11" r="5" fill="#777777"/><circle cx="35" cy="10.5" r="4.5" fill="#888888"/>
      <circle cx="65" cy="11" r="5" fill="#777777"/><circle cx="65" cy="10.5" r="4.5" fill="#888888"/>
  </svg>
);