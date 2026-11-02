import React, { useEffect, useState } from 'react';
import { Target, CheckCircle2, TrendingUp } from 'lucide-react';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = 110,
  strokeWidth = 7,
}) => {
  const [displayScore, setDisplayScore] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(100, Math.max(0, score));
  const offset = circumference - (normalizedScore / 100) * circumference;

  let strokeColor = '#8DA9C4';
  let badgeText = 'Some overlap';
  let badgeClass = 'text-[#334E68] bg-[#F0F4F8] border-[#CBD5E1]';
  let Icon = Target;

  if (normalizedScore >= 75) {
    strokeColor = '#1D4ED8';
    badgeText = 'A strong match';
    badgeClass = 'text-[#1D4ED8] bg-blue-wash border-blue-pale';
    Icon = CheckCircle2;
  } else if (normalizedScore >= 50) {
    strokeColor = '#2563EB';
    badgeText = 'A promising match';
    badgeClass = 'text-[#0B2545] bg-[#EFF5FC] border-[#93C5FD]/60';
    Icon = TrendingUp;
  }

  useEffect(() => {
    let start = 0;
    const duration = 250;
    const steps = 12;
    const stepTime = duration / steps;
    const increment = normalizedScore / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= normalizedScore) {
        setDisplayScore(normalizedScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [normalizedScore]);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B2545]">
            {displayScore}%
          </span>
          <span className="text-[10px] text-[#627D98] font-bold uppercase tracking-wider">resume match</span>
        </div>
      </div>

      <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight border ${badgeClass}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{badgeText}</span>
      </div>
    </div>
  );
};
