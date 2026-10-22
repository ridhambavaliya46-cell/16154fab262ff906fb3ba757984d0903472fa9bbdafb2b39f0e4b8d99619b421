import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Clock, ShieldCheck } from 'lucide-react';

/**
 * Owner profile shown in the paywall.
 *
 * WHY THERE IS A FALLBACK AVATAR
 * ------------------------------
 * The photo is optional (see `OWNER_AVATAR_URL`). Shipping a stock portrait as
 * a stand-in would be worse than showing no photo at all — it would put a
 * stranger's face next to a payment request. So when no photo is configured the
 * component renders the owner's initials on the brand gradient, which is honest
 * and still looks deliberate.
 *
 * ADDING A PHOTO
 * --------------
 *   1. Drop the image at  src/assets/images/owner.jpg  (square, >= 256px), or
 *   2. set  OWNER_AVATAR_URL=https://…/owner.jpg  in the deployment env.
 *
 * `javascript:` and `data:` URLs are rejected by `sanitizeAvatarUrl` before they
 * ever reach this component.
 */

export interface OwnerProfileData {
  name: string;
  handle: string;
  role: string;
  responseTime: string;
  avatarUrl: string | null;
}

interface OwnerProfileCardProps {
  owner: OwnerProfileData;
  /**
   * `compact` — paywall strip on a light surface.
   * `full`    — standalone card on a light surface.
   * `dark`    — footer, which sits on the navy brand background. Light-theme text
   *             colours are unreadable there, so this variant flips to on-navy.
   */
  variant?: 'compact' | 'full' | 'dark';
  className?: string;
}

/** Initials for the fallback avatar, e.g. "ResumeSetu Support" -> "RS". */
function initialsFor(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/**
 * Avatar that degrades safely: photo -> branded monogram.
 * `onError` is what makes a broken remote URL land on the monogram rather than
 * the browser's torn-image glyph.
 */
const OwnerAvatar: React.FC<{
  src: string | null;
  name: string;
  size: number;
  className?: string;
}> = ({ src, name, size, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ring-2 ring-white/70 shadow-[0_4px_14px_rgba(11,37,69,0.18)] ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={src as string}
          alt={`${name} — ResumeSetu owner`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`${name} — ResumeSetu owner`}
          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#0B2545] text-white font-['Space_Grotesk']"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initialsFor(name)}
        </div>
      )}
    </div>
  );
};

export const OwnerProfileCard: React.FC<OwnerProfileCardProps> = ({
  owner,
  variant = 'compact',
  className = '',
}) => {
  if (variant === 'full') {
    return (
      <section
        aria-label="ResumeSetu owner"
        className={`surface-panel rounded-2xl p-5 sm:p-6 ${className}`}
      >
        <div className="flex items-start gap-4">
          <OwnerAvatar src={owner.avatarUrl} name={owner.name} size={72} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-[#0B2545] font-['Space_Grotesk'] break-words">
              {owner.name}
            </h3>
            <p className="text-xs text-[#334E68] mt-0.5 break-words">{owner.role}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-wash border border-[#93C5FD]/60 px-2.5 py-1 text-[11px] font-bold text-[#1D4ED8]">
                <MessageCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{owner.handle}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-2.5 py-1 text-[11px] font-semibold text-[#627D98]">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">{owner.responseTime}</span>
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const dark = variant === 'dark';

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-3 ${
        dark ? 'border border-white/10 bg-white/5' : 'border border-line bg-surface/70'
      } ${className}`}
    >
      <OwnerAvatar src={owner.avatarUrl} name={owner.name} size={48} />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[11px] font-bold uppercase tracking-wider ${
            dark ? 'text-[#8DA9C4]' : 'text-[#627D98]'
          }`}
        >
          Activation is handled personally by
        </p>
        <p
          className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-[#0B2545]'}`}
        >
          {owner.name}
        </p>
        <p className={`text-[11px] truncate ${dark ? 'text-[#8DA9C4]/80' : 'text-[#627D98]'}`}>
          {owner.role} ·{' '}
          <span className={`font-semibold ${dark ? 'text-[#93C5FD]' : 'text-[#1D4ED8]'}`}>
            {owner.handle}
          </span>
        </p>
      </div>
    </div>
  );
};

/**
 * Copyable verification code.
 *
 * The reference is what lets the admin confirm a message really came from this
 * account rather than being typed by hand in Telegram, so it is shown
 * prominently and offered as one-click copy.
 */
export const PaymentReference: React.FC<{ reference: string }> = ({ reference }) => {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== undefined) clearTimeout(copiedTimerRef.current);
    },
    []
  );

  return (
    <div className="rounded-2xl border border-[#93C5FD]/60 bg-blue-wash/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
            Your verification code
          </p>
          <p className="font-mono text-sm font-bold text-[#0B2545] tracking-wider break-all mt-0.5">
            {reference}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(reference);
              setCopied(true);
              if (copiedTimerRef.current !== undefined) clearTimeout(copiedTimerRef.current);
              copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked: the code is visible on screen and is already
              // included in the prefilled Telegram message, so this is not fatal.
            }
          }}
          className="shrink-0 rounded-lg border border-[#93C5FD]/70 bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white transition-colors cursor-pointer shrink-0"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[#334E68] leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0 mt-px" />
        <span>
          This code is generated by ResumeSetu for your account only. It lets us confirm the
          message is really from you rather than someone impersonating you.
        </span>
      </p>
    </div>
  );
};

export default OwnerProfileCard;
