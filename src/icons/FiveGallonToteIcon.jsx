import { LIQUID_FILL_COLOR } from '../constants';

export const FiveGallonToteIcon = ({ fillSvgHeight = 0 }) => (
  <svg viewBox="0 0 60 80" className="w-10 h-14 inline-block">
      <defs>
          <linearGradient id="smallToteBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: "rgba(200, 210, 220, 0.9)"}} />
              <stop offset="50%" style={{stopColor: "rgba(220, 230, 240, 0.9)"}} />
              <stop offset="100%" style={{stopColor: "rgba(200, 210, 220, 0.9)"}} />
          </linearGradient>
          <clipPath id="smallToteClipUnique">
              <rect x="5" y="10" width="50" height="65" rx="2"/>
          </clipPath>
      </defs>
      <rect x="5" y="10" width="50" height="65" rx="2" fill="url(#smallToteBodyGradient)" stroke="#777" strokeWidth="1.5"/>
      {fillSvgHeight > 0 && <rect x="5" y={75 - fillSvgHeight} width="50" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#smallToteClipUnique)" rx="2"/>}
      <rect x="22" y="3" width="16" height="7" rx="1" fill="#585858" />
      <path d="M 18 10 Q 30 5 42 10" stroke="#606060" strokeWidth="1.5" fill="none" />
  </svg>
);