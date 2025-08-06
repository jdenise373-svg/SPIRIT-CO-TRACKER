import { LIQUID_FILL_COLOR } from '../constants';

export const WoodenBarrelIcon = ({ fillSvgHeight = 0 }) => (
  <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
      <defs>
          <radialGradient id="barrelBodyGradient" cx="50%" cy="50%" r="70%" fx="30%" fy="30%">
              <stop offset="0%" style={{stopColor: "#B8860B", stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: "#8B4513", stopOpacity: 1}} />
          </radialGradient>
          <linearGradient id="hoopGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{stopColor: "#C0C0C0", stopOpacity: 1}} />
              <stop offset="50%" style={{stopColor: "#A9A9A9", stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: "#808080", stopOpacity: 1}} />
          </linearGradient>
          <clipPath id="barrelClip">
              <ellipse cx="50" cy="60" rx="45" ry="58"/>
          </clipPath>
      </defs>
      <ellipse cx="50" cy="60" rx="45" ry="58" fill="url(#barrelBodyGradient)"/>
      {fillSvgHeight > 0 && <rect x="5" y={118 - fillSvgHeight - (58 - (Math.sqrt(1-(0/45)**2))*58) } width="90" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#barrelClip)"/>}
      {[15, 25, 35, 45, 55, 65, 75, 85].map(xPos => (<path key={xPos} d={`M ${xPos} 15 Q ${xPos} 60 ${xPos} 105`} stroke="rgba(0,0,0,0.1)" strokeWidth="1" fill="none"/>))}
      <ellipse cx="50" cy="22" rx="42" ry="10" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
      <ellipse cx="50" cy="42" rx="45" ry="9" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
      <ellipse cx="50" cy="78" rx="45" ry="9" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
      <ellipse cx="50" cy="98" rx="42" ry="10" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
      <ellipse cx="50" cy="12" rx="40" ry="8" fill="#A0522D" stroke="#543517" strokeWidth="1.5"/>
      <ellipse cx="50" cy="108" rx="40" ry="8" fill="#8B4513" stroke="#543517" strokeWidth="1.5"/>
      <circle cx="50" cy="30" r="3" fill="#4A2E10"/>
  </svg>
);