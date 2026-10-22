import React from 'react';

const ArtworkFrame = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 320 176"
    role="img"
    aria-hidden="true"
    className="h-full w-full"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="artwork-surface" x1="28" y1="14" x2="292" y2="165" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff" />
        <stop offset="1" stopColor="#EAF2FF" />
      </linearGradient>
      <linearGradient id="artwork-blue" x1="93" y1="35" x2="234" y2="139" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
      <filter id="artwork-shadow" x="34" y="10" width="252" height="166" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </defs>
    <circle cx="272" cy="32" r="36" fill="#BFDBFE" fillOpacity=".32" />
    <circle cx="42" cy="142" r="40" fill="#DBEAFE" fillOpacity=".65" />
    <ellipse cx="162" cy="148" rx="107" ry="14" fill="#0B2545" fillOpacity=".13" filter="url(#artwork-shadow)" />
    {children}
  </svg>
);

export function ResumeDocumentIllustration() {
  return (
    <ArtworkFrame>
      <rect x="84" y="19" width="151" height="132" rx="15" fill="url(#artwork-surface)" stroke="#C7DDFB" />
      <rect x="99" y="34" width="40" height="45" rx="10" fill="#DBEAFE" />
      <path d="M109 63l8-10 7 7 8-12" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M152 39h57M152 49h43M99 91h119" stroke="#B8CBE0" strokeWidth="5" strokeLinecap="round" />
      <rect x="99" y="105" width="59" height="20" rx="7" fill="#DBEAFE" />
      <path d="M109 115h39" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
      <rect x="164" y="105" width="54" height="20" rx="7" fill="#E8F6EF" />
      <path d="M174 115h34" stroke="#38A169" strokeWidth="4" strokeLinecap="round" />
      <circle cx="235" cy="117" r="18" fill="url(#artwork-blue)" stroke="white" strokeWidth="5" />
      <path d="m228 117 5 5 9-11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M71 49h18M230 71h19" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
      <circle cx="71" cy="49" r="4" fill="#1D4ED8" />
      <circle cx="249" cy="71" r="4" fill="#1D4ED8" />
    </ArtworkFrame>
  );
}

export function MatchScoreIllustration() {
  return (
    <ArtworkFrame>
      <rect x="67" y="29" width="186" height="119" rx="17" fill="url(#artwork-surface)" stroke="#C7DDFB" />
      <path d="M95 120a65 65 0 0 1 130 0" stroke="#D7E5F6" strokeWidth="13" strokeLinecap="round" />
      <path d="M95 120a65 65 0 0 1 98-56" stroke="url(#artwork-blue)" strokeWidth="13" strokeLinecap="round" />
      <text x="160" y="103" fill="#0B2545" fontFamily="Inter, sans-serif" fontSize="31" fontWeight="800" textAnchor="middle">78</text>
      <text x="160" y="123" fill="#627D98" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="700" letterSpacing="1.2" textAnchor="middle">MATCH SCORE</text>
      <rect x="88" y="135" width="144" height="5" rx="2.5" fill="#D7E5F6" />
      <rect x="88" y="135" width="112" height="5" rx="2.5" fill="#3B82F6" />
      <circle cx="231" cy="44" r="15" fill="#E8F6EF" />
      <path d="m225 44 4 4 8-9" stroke="#25855A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="77" cy="59" r="4" fill="#60A5FA" />
      <circle cx="246" cy="117" r="4" fill="#A78BFA" />
    </ArtworkFrame>
  );
}

export function KeywordMapIllustration() {
  return (
    <ArtworkFrame>
      <rect x="65" y="25" width="190" height="126" rx="18" fill="url(#artwork-surface)" stroke="#C7DDFB" />
      <text x="85" y="49" fill="#627D98" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="700" letterSpacing="1">JOB SKILLS</text>
      <rect x="85" y="60" width="69" height="27" rx="9" fill="#DBEAFE" />
      <text x="119.5" y="77" fill="#1D4ED8" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle">React</text>
      <rect x="162" y="60" width="72" height="27" rx="9" fill="#DBEAFE" />
      <text x="198" y="77" fill="#1D4ED8" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle">SQL</text>
      <rect x="85" y="96" width="81" height="27" rx="9" fill="#E8F6EF" />
      <text x="125.5" y="113" fill="#25855A" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle">Leadership</text>
      <rect x="174" y="96" width="60" height="27" rx="9" fill="#FFF5DB" />
      <text x="204" y="113" fill="#A66B00" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle">Cloud</text>
      <path d="M104 136h113" stroke="#D7E5F6" strokeWidth="4" strokeLinecap="round" />
      <circle cx="75" cy="42" r="4" fill="#60A5FA" />
      <circle cx="243" cy="135" r="4" fill="#A78BFA" />
      <path d="M50 70h10m-5-5v10M259 72h10m-5-5v10" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
    </ArtworkFrame>
  );
}
