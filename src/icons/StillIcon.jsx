import { COPPER_COLOR_LIGHT, COPPER_COLOR_DARK, LIQUID_FILL_COLOR } from '../constants';

export const StillIcon = ({ fillSvgHeight = 0 }) => (
  <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
      <defs>
          <linearGradient id="copperPotGradientStill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor: COPPER_COLOR_LIGHT, stopOpacity:1}} />
              <stop offset="100%" style={{stopColor: COPPER_COLOR_DARK, stopOpacity:1}} />
          </linearGradient>
          <linearGradient id="copperPipeGradientStill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{stopColor: COPPER_COLOR_DARK, stopOpacity:1}} />
              <stop offset="50%" style={{stopColor: COPPER_COLOR_LIGHT, stopOpacity:1}} />
              <stop offset="100%" style={{stopColor: COPPER_COLOR_DARK, stopOpacity:1}} />
          </linearGradient>
          <clipPath id="stillPotClip">
              <ellipse cx="50" cy="85" rx="40" ry="30"/>
          </clipPath>
      </defs>
      <ellipse cx="50" cy="85" rx="40" ry="30" fill="url(#copperPotGradientStill)" stroke={COPPER_COLOR_DARK} strokeWidth="1.5"/>
      {fillSvgHeight > 0 && <rect x="10" y={115 - fillSvgHeight} width="80" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#stillPotClip)"/>}
      <path d="M50,55 C 30,55 20,40 20,25 C 20,10 35,0 50,0 C 65,0 80,10 80,25 C 80,40 70,55 50,55 Z" fill="url(#copperPotGradientStill)" stroke={COPPER_COLOR_DARK} strokeWidth="1.5"/>
      <path d="M80,25 C 90,25 95,35 95,45 L 95,65 C 95,75 90,80 80,80" stroke="url(#copperPipeGradientStill)" strokeWidth="8" fill="none" strokeLinecap="round"/>
      <path d="M95,65 Q 85,70 80,60" stroke="url(#copperPipeGradientStill)" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <circle cx="45" cy="58" r="1.5" fill={COPPER_COLOR_DARK}/><circle cx="55" cy="58" r="1.5" fill={COPPER_COLOR_DARK}/>
      <circle cx="35" cy="70" r="1.5" fill={COPPER_COLOR_DARK}/><circle cx="65" cy="70" r="1.5" fill={COPPER_COLOR_DARK}/>
  </svg>
);