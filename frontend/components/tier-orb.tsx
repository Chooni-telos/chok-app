export function TierOrb({ code, className = "" }: { code: string; className?: string }) {
  const Orb = ORBS[code];
  if (!Orb) return null;
  return <Orb className={className} />;
}

const ORBS: Record<string, React.FC<{ className?: string }>> = {
  god: OrbGod,
  genius: OrbGenius,
  sharp: OrbSharp,
  rookie: OrbRookie,
  dull: OrbDull,
  cursed: OrbCursed,
};

function OrbGod({ className }: { className?: string }) {
  return (
    <svg className={`orb orb-glow-god orb-float ${className}`} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="g1-core" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff8d6" />
          <stop offset="35%" stopColor="#ffd86b" />
          <stop offset="70%" stopColor="#d68a1e" />
          <stop offset="100%" stopColor="#6b3a00" />
        </radialGradient>
        <radialGradient id="g1-hi" cx="35%" cy="30%" r="25%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g1-galaxy" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7c0" stopOpacity="0" />
          <stop offset="40%" stopColor="#ffb14a" stopOpacity=".6" />
          <stop offset="100%" stopColor="#5a2400" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="orb-rotate" opacity=".55">
        <circle cx="100" cy="100" r="92" fill="none" stroke="#ffd56b" strokeWidth=".6" strokeDasharray="2 6" />
        <polygon points="100,12 188,156 12,156" fill="none" stroke="#ffe7a0" strokeWidth=".5" />
        <polygon points="100,188 12,44 188,44" fill="none" stroke="#ffe7a0" strokeWidth=".5" />
      </g>
      <g className="orb-rotate-rev" opacity=".5">
        <circle cx="100" cy="100" r="84" fill="none" stroke="#fff1b8" strokeWidth=".4" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="#ffd56b" strokeWidth=".4" strokeDasharray="1 3" />
      </g>
      <circle cx="100" cy="100" r="68" fill="url(#g1-core)" />
      <circle cx="100" cy="100" r="68" fill="url(#g1-galaxy)" />
      <g className="orb-rotate" opacity=".7" style={{ transformOrigin: "100px 100px" }}>
        <path d="M50,100 a50,50 0 0 1 100,0" fill="none" stroke="#fff4c0" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
        <path d="M60,90 a40,40 0 0 1 80,20" fill="none" stroke="#ffeaa0" strokeWidth="1" strokeLinecap="round" opacity=".6" />
        <path d="M70,115 a30,30 0 0 1 60,-15" fill="none" stroke="#fff" strokeWidth=".8" strokeLinecap="round" opacity=".5" />
      </g>
      <g className="orb-spark">
        <circle cx="85" cy="85" r="1.4" fill="#fff" />
        <circle cx="118" cy="95" r="1" fill="#fff" />
        <circle cx="105" cy="115" r="1.6" fill="#fff" />
        <circle cx="80" cy="118" r="1" fill="#fff" />
        <circle cx="130" cy="120" r="1.2" fill="#fff" />
      </g>
      <ellipse cx="80" cy="78" rx="22" ry="14" fill="url(#g1-hi)" />
      <g opacity=".5" className="orb-spark">
        <line x1="100" y1="6" x2="100" y2="22" stroke="#ffe080" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="100" y1="178" x2="100" y2="194" stroke="#ffe080" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="100" x2="22" y2="100" stroke="#ffe080" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="178" y1="100" x2="194" y2="100" stroke="#ffe080" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function OrbGenius({ className }: { className?: string }) {
  return (
    <svg className={`orb orb-glow-genius orb-float-2 ${className}`} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="g2-core" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f3e4ff" />
          <stop offset="35%" stopColor="#c8a6ff" />
          <stop offset="70%" stopColor="#7a3fd9" />
          <stop offset="100%" stopColor="#2a0a55" />
        </radialGradient>
        <radialGradient id="g2-hi" cx="35%" cy="30%" r="25%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="orb-rotate-rev" opacity=".65">
        <circle cx="100" cy="100" r="86" fill="none" stroke="#c8a6ff" strokeWidth=".5" strokeDasharray="4 3" />
        <path d="M100,14 L100,28 M186,100 L172,100 M100,186 L100,172 M14,100 L28,100" stroke="#e3ccff" strokeWidth="1" strokeLinecap="round" />
        <circle cx="100" cy="14" r="2" fill="#e3ccff" />
        <circle cx="186" cy="100" r="2" fill="#e3ccff" />
        <circle cx="100" cy="186" r="2" fill="#e3ccff" />
        <circle cx="14" cy="100" r="2" fill="#e3ccff" />
      </g>
      <g opacity=".4">
        <path d="M30,40 Q 60,30 80,50 T 130,40" fill="none" stroke="#c8a6ff" strokeWidth=".6" strokeDasharray="2 2" />
        <path d="M170,160 Q 140,170 120,150 T 70,160" fill="none" stroke="#c8a6ff" strokeWidth=".6" strokeDasharray="2 2" />
      </g>
      <circle cx="100" cy="100" r="66" fill="url(#g2-core)" />
      <g className="orb-spark" opacity=".95">
        <path d="M85,55 L95,85 L78,90 L100,140 L92,110 L108,108 L88,68 Z" fill="#fff" opacity=".85" />
        <path d="M120,60 L114,82 L126,84 L110,120" fill="none" stroke="#fff0ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <ellipse cx="80" cy="78" rx="22" ry="14" fill="url(#g2-hi)" />
      <g className="orb-rotate" style={{ transformOrigin: "100px 100px" }}>
        <circle cx="100" cy="22" r="3" fill="#e7d4ff" opacity=".9" />
        <circle cx="178" cy="100" r="2.5" fill="#c8a6ff" opacity=".9" />
        <circle cx="100" cy="178" r="2" fill="#fff" opacity=".7" />
        <circle cx="22" cy="100" r="2.5" fill="#c8a6ff" opacity=".9" />
      </g>
    </svg>
  );
}

function OrbSharp({ className }: { className?: string }) {
  return (
    <svg className={`orb orb-glow-sharp orb-float-3 ${className}`} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="g3-face1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dff1ff" />
          <stop offset="100%" stopColor="#3d7fc4" />
        </linearGradient>
        <linearGradient id="g3-face2" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#a3cfff" />
          <stop offset="100%" stopColor="#1f4d8a" />
        </linearGradient>
        <linearGradient id="g3-face3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf6ff" />
          <stop offset="100%" stopColor="#6aa7e0" />
        </linearGradient>
        <linearGradient id="g3-face4" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bcdcff" />
          <stop offset="100%" stopColor="#26528a" />
        </linearGradient>
      </defs>
      <g>
        <polygon points="100,30 60,80 100,100" fill="url(#g3-face2)" opacity=".95" />
        <polygon points="100,30 140,80 100,100" fill="url(#g3-face3)" opacity=".95" />
        <polygon points="60,80 40,140 100,100" fill="url(#g3-face1)" />
        <polygon points="140,80 160,140 100,100" fill="url(#g3-face4)" />
        <polygon points="40,140 100,170 100,100" fill="url(#g3-face3)" opacity=".9" />
        <polygon points="160,140 100,170 100,100" fill="url(#g3-face2)" opacity=".9" />
        <g stroke="#eaf6ff" strokeWidth=".8" fill="none" opacity=".7">
          <polygon points="100,30 60,80 40,140 100,170 160,140 140,80" />
          <line x1="100" y1="30" x2="100" y2="170" />
          <line x1="60" y1="80" x2="140" y2="80" />
          <line x1="40" y1="140" x2="160" y2="140" />
          <line x1="100" y1="100" x2="100" y2="30" />
          <line x1="100" y1="100" x2="60" y2="80" />
          <line x1="100" y1="100" x2="140" y2="80" />
          <line x1="100" y1="100" x2="40" y2="140" />
          <line x1="100" y1="100" x2="160" y2="140" />
          <line x1="100" y1="100" x2="100" y2="170" />
        </g>
        <polygon points="100,30 80,60 100,70" fill="#fff" opacity=".55" />
        <polygon points="60,80 70,100 55,110" fill="#fff" opacity=".3" />
      </g>
      <g className="orb-spark" opacity=".8">
        <circle cx="40" cy="60" r="1.6" fill="#e8f4ff" />
        <circle cx="170" cy="70" r="1.2" fill="#cfe6ff" />
        <circle cx="30" cy="160" r="1.4" fill="#e8f4ff" />
        <circle cx="175" cy="160" r="1" fill="#cfe6ff" />
      </g>
    </svg>
  );
}

function OrbRookie({ className }: { className?: string }) {
  return (
    <svg className={`orb orb-glow-rookie orb-float ${className}`} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="g4-core" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f4ffe0" />
          <stop offset="40%" stopColor="#c2f29a" />
          <stop offset="80%" stopColor="#6cc23f" />
          <stop offset="100%" stopColor="#2f6315" />
        </radialGradient>
        <radialGradient id="g4-hi" cx="35%" cy="30%" r="25%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="84" fill="none" stroke="#c2f29a" strokeWidth=".6" strokeDasharray="2 5" opacity=".5" />
      <circle cx="100" cy="100" r="66" fill="url(#g4-core)" />
      <g transform="translate(100 118)">
        <ellipse cx="0" cy="0" rx="14" ry="9" fill="#5e3d1d" />
        <ellipse cx="-3" cy="-2" rx="6" ry="3" fill="#7a5230" opacity=".7" />
        <path d="M0,-2 C 2,-15 -2,-25 0,-38" stroke="#3e7a1e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M0,-22 C -10,-26 -16,-20 -14,-12 C -6,-14 -2,-18 0,-22 Z" fill="#7ec74a" />
        <path d="M0,-30 C 12,-34 18,-28 14,-20 C 6,-22 2,-26 0,-30 Z" fill="#9ce06a" />
        <circle cx="0" cy="-40" r="2.5" fill="#d6f7a8" />
      </g>
      <ellipse cx="80" cy="78" rx="22" ry="14" fill="url(#g4-hi)" />
      <g className="orb-spark" opacity=".8">
        <circle cx="40" cy="50" r="2" fill="#d6f7a8" />
        <circle cx="160" cy="60" r="1.6" fill="#c2f29a" />
        <circle cx="170" cy="150" r="2" fill="#d6f7a8" />
        <circle cx="30" cy="160" r="1.6" fill="#c2f29a" />
      </g>
    </svg>
  );
}

function OrbDull({ className }: { className?: string }) {
  return (
    <svg className={`orb orb-glow-dull orb-float-2 ${className}`} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="g5-core" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#c9cad3" />
          <stop offset="55%" stopColor="#7a7d8a" />
          <stop offset="100%" stopColor="#34363f" />
        </radialGradient>
        <radialGradient id="g5-hi" cx="35%" cy="30%" r="22%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <pattern id="g5-tex" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="1" cy="1" r=".5" fill="#000" opacity=".15" />
          <circle cx="4" cy="3" r=".4" fill="#fff" opacity=".08" />
        </pattern>
      </defs>
      <circle cx="100" cy="100" r="68" fill="url(#g5-core)" />
      <circle cx="100" cy="100" r="68" fill="url(#g5-tex)" opacity=".9" />
      <ellipse cx="65" cy="120" rx="14" ry="6" fill="#000" opacity=".15" />
      <ellipse cx="130" cy="78" rx="10" ry="5" fill="#fff" opacity=".07" />
      <ellipse cx="115" cy="135" rx="8" ry="4" fill="#000" opacity=".12" />
      <g stroke="#3a3c46" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".6">
        <path d="M85,90 L92,82 L92,98 L99,90" />
        <path d="M110,105 L118,98 M118,98 L118,112 M118,98 L125,105" />
        <circle cx="100" cy="115" r="3" />
      </g>
      <ellipse cx="82" cy="80" rx="20" ry="12" fill="url(#g5-hi)" />
      <ellipse cx="100" cy="178" rx="50" ry="6" fill="#000" opacity=".35" />
    </svg>
  );
}

function OrbCursed({ className }: { className?: string }) {
  return (
    <svg className={`orb orb-glow-cursed orb-glitch ${className}`} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="g6-core" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffd6d6" />
          <stop offset="35%" stopColor="#ff6464" />
          <stop offset="75%" stopColor="#9c1d1d" />
          <stop offset="100%" stopColor="#3a0808" />
        </radialGradient>
        <radialGradient id="g6-hi" cx="35%" cy="30%" r="25%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="g6-clip">
          <circle cx="100" cy="100" r="66" />
        </clipPath>
      </defs>
      <g transform="rotate(-6 100 100)">
        <ellipse cx="100" cy="100" rx="68" ry="64" fill="url(#g6-core)" />
        <g clipPath="url(#g6-clip)" opacity=".7">
          <rect x="34" y="70" width="132" height="3" fill="#ffd0d0" />
          <rect x="34" y="95" width="132" height="2" fill="#fff" opacity=".7" />
          <rect x="34" y="118" width="132" height="4" fill="#ff8a8a" opacity=".8" />
          <rect x="34" y="138" width="132" height="2" fill="#ffd0d0" opacity=".5" />
        </g>
        <ellipse cx="80" cy="78" rx="22" ry="14" fill="url(#g6-hi)" />
      </g>
      <g stroke="#2a0303" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M70,55 L88,80 L78,98 L96,116 L88,138 L110,158" />
        <path d="M88,80 L72,82" />
        <path d="M96,116 L116,108" />
        <path d="M88,138 L70,140" />
      </g>
      <g stroke="#fff" strokeWidth=".6" fill="none" strokeLinecap="round" opacity=".6">
        <path d="M70,55 L88,80 L78,98 L96,116 L88,138 L110,158" />
      </g>
      <g className="orb-spark" opacity=".9">
        <rect x="36" y="56" width="6" height="6" fill="#ff6464" />
        <rect x="160" y="80" width="4" height="4" fill="#ff9a9a" />
        <rect x="150" y="150" width="6" height="3" fill="#ffd0d0" />
        <rect x="40" y="148" width="4" height="4" fill="#ff6464" />
      </g>
      <circle cx="100" cy="100" r="84" fill="none" stroke="#ff8a8a" strokeWidth=".5" strokeDasharray="3 5" opacity=".5" transform="rotate(15 100 100)" />
    </svg>
  );
}
