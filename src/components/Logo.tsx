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
            ? 'bg-[#132431] border border-[#A88A5C] shadow-[0_4px_12px_rgba(19,36,49,0.22)]'
            : 'bg-[#17364A] border border-[#A88A5C] shadow-[0_4px_12px_rgba(23,54,74,0.18)] group-hover:bg-[#24485C]'
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
          {/* A compact temple mark: the product's bridge expressed as a Greek stoa. */}
          <path d="M4 11.5 16 5l12 6.5v2H4z" fill="#D7C197" />
          <path d="M6 15h20M5 26h22" stroke="#F4F0E6" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 16v8m5-8v8m6-8v8m5-8v8" stroke="#F4F0E6" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 28h24" stroke="#D7C197" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Brand Wordmark strictly in Single Color per requirement */}
      {showText && (
        <span
          className={`font-normal font-serif ${iconDimensions.text} tracking-[0.01em] transition-colors hidden min-[340px]:inline whitespace-nowrap ${
            isDark ? 'text-white' : 'text-[#17364A]'
          }`}
        >
          ResumeSetu
        </span>
      )}
    </div>
  );
};
