import { STEEL_COLOR_LIGHT, STEEL_COLOR_DARK, LIQUID_FILL_COLOR } from '../constants';

export const ToteIcon = ({ fillSvgHeight = 0 }) => (
  <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
       <defs><linearGradient id="toteCageGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={STEEL_COLOR_LIGHT} /><stop offset="100%" stopColor={STEEL_COLOR_DARK} /></linearGradient><clipPath id="toteClip"><rect x="10" y="10" width="80" height="100" rx="3"/></clipPath></defs>
      <rect x="5" y="5" width="90" height="110" fill="none" stroke="url(#toteCageGradient)" strokeWidth="3.5" rx="5"/>
      <line x1="5" y1="30" x2="95" y2="30" stroke="url(#toteCageGradient)" strokeWidth="3"/><line x1="5" y1="60" x2="95" y2="60" stroke="url(#toteCageGradient)" strokeWidth="3"/><line x1="5" y1="90" x2="95" y2="90" stroke="url(#toteCageGradient)" strokeWidth="3"/>
      <line x1="30" y1="5" x2="30" y2="115" stroke="url(#toteCageGradient)" strokeWidth="3"/><line x1="70" y1="5" x2="70" y2="115" stroke="url(#toteCageGradient)" strokeWidth="3"/>
      <rect x="10" y="10" width="80" height="100" fill="rgba(230, 230, 250, 0.9)" rx="3"/>
      {fillSvgHeight > 0 && <rect x="10" y={110 - fillSvgHeight} width="80" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#toteClip)" rx="3"/>}
      <circle cx="50" cy="15" r="10" fill="#505050"/><circle cx="50" cy="14.5" r="8" fill="#686868"/>
      <rect x="42" y="108" width="16" height="10" fill="#505050" rx="1.5"/>
  </svg>
);