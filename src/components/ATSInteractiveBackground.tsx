import React from 'react';

/**
 * A quiet page surface shared by the public site and workspace.
 *
 * The previous version used cursor-following glows, a blueprint grid and
 * several saturated colour blooms. Those effects made the product feel like
 * a speculative AI demo and competed with the resume itself. The interface
 * now uses a stable paper-toned background so the content carries the focus.
 */
export const ATSInteractiveBackground: React.FC = () => (
  <div
    className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#F7F7F3]"
    aria-hidden="true"
  >
    <div
      className="absolute -top-56 right-[-12rem] h-[42rem] w-[42rem] rounded-full opacity-60 blur-3xl"
      style={{
        background:
          'radial-gradient(circle, rgba(214, 226, 214, 0.68) 0%, rgba(247, 247, 243, 0) 72%)',
      }}
    />
    <div
      className="absolute bottom-[-18rem] left-[-12rem] h-[38rem] w-[38rem] rounded-full opacity-50 blur-3xl"
      style={{
        background:
          'radial-gradient(circle, rgba(239, 224, 201, 0.58) 0%, rgba(247, 247, 243, 0) 70%)',
      }}
    />
    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/70 to-transparent" />
  </div>
);
