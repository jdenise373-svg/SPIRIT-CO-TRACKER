import { STEEL_COLOR_LIGHT, STEEL_COLOR_DARK, LIQUID_FILL_COLOR } from '../constants';

export const SquareTankIcon = ({ fillSvgHeight = 0 }) => (
  <svg viewBox="0 0 120 120" className="w-20 h-20 inline-block">
      <defs><linearGradient id="cageGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={STEEL_COLOR_LIGHT} /><stop offset="100%" stopColor={STEEL_COLOR_DARK} /></linearGradient><clipPath id="tankClip"><rect x="15" y="15" width="90" height="90" rx="3"/></clipPath></defs>
      <rect x="5" y="5" width="110" height="110" fill="none" stroke="url(#cageGradient)" strokeWidth="5" rx="5"/>
      {[35, 65, 95].map(pos => <line key={`h-${pos}`} x1="5" y1={pos} x2="115" y2={pos} stroke="url(#cageGradient)" strokeWidth="4"/>)}
      {[35, 65, 95].map(pos => <line key={`v-${pos}`} x1={pos} y1="5" x2={pos} y2="115" stroke="url(#cageGradient)" strokeWidth="4"/>)}
      <rect x="15" y="15" width="90" height="90" fill="rgba(220, 230, 240, 0.85)" rx="3"/>
      {fillSvgHeight > 0 && <rect x="15" y={105 - fillSvgHeight} width="90" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#tankClip)" rx="3"/>}
      <circle cx="60" cy="20" r="12" fill="#606060"/><circle cx="60" cy="19.5" r="10" fill="#787878"/>
      <rect x="50" y="102" width="20" height="15" fill="#606060" rx="2"/><rect x="52" y="107" width="16" height="5" fill="#787878" rx="1"/>
  </svg>
);