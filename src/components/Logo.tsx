import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dark' | 'light';
  showText?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'default',
  showText = true,
  onClick,
  className = '',
}) => {
  const iconDimensions = {
    sm: { container: 30, svg: 18, text: 'text-sm' },
    md: { container: 36, svg: 22, text: 'text-lg' },
    lg: { container: 44, svg: 28, text: 'text-2xl' },
    xl: { container: 52, svg: 34, text: 'text-3xl' },
  }[size];

  const isDark = variant === 'dark';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Simple, durable mark that stays legible at every size. */}
      <div
        className={`relative flex items-center justify-center shrink-0 rounded-xl transition-all duration-200 ${
          isDark
            ? 'bg-[#173B36] border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.18)]'
            : 'bg-[#173B36] border border-[#173B36] shadow-[0_4px_12px_rgba(23,59,54,0.18)] group-hover:bg-[#24584F]'
        }`}
        style={{ width: iconDimensions.container, height: iconDimensions.container }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: iconDimensions.svg, height: iconDimensions.svg }}
          className="transition-transform duration-200 group-hover:scale-105"
        >
          {/* Left Pier: Candidate Resume Anchor */}
          <rect x="5.5" y="11" width="3.5" height="15" rx="1.5" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M 5 11 L 9.5 11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

          {/* Right Pier: Target Role Anchor (Elevated) */}
          <rect x="23" y="7" width="3.5" height="19" rx="1.5" fill="#FFFFFF" fillOpacity="0.95" />
          <path d="M 22.5 7 L 27 7" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

          {/* Catenary Suspension Arc Cable connecting Left Pier to Right Pier */}
          <path
            d="M 7.2 11 Q 16 23 24.8 7"
            stroke="#60A5FA"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Structural Vertical Tension Cables */}
          <line x1="11.5" y1="16.5" x2="11.5" y2="21" stroke="#93C5FD" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16" y1="19.5" x2="16" y2="22.5" stroke="#93C5FD" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="20.5" y1="16" x2="20.5" y2="21.5" stroke="#93C5FD" strokeWidth="1.2" strokeLinecap="round" />

          {/* Horizontal Bridge Deck Line */}
          <line x1="4.5" y1="22" x2="27.5" y2="22" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />

          {/* Glowing Keystone Apex Center */}
          <circle cx="16" cy="19.5" r="1.8" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Brand Wordmark strictly in Single Color per requirement */}
      {showText && (
        <span
          className={`font-extrabold ${iconDimensions.text} tracking-tight transition-colors hidden min-[340px]:inline whitespace-nowrap ${
            isDark ? 'text-white' : 'text-[#0B2545]'
          }`}
        >
          ResumeSetu
        </span>
      )}
    </div>
  );
};
