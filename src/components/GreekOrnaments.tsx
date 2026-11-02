import React from 'react';

/** Quiet Parthenon line art anchors the hero's Greek-classic composition. */
export const GreekTemple: React.FC = () => (
  <div className="greek-temple-wrap" aria-hidden="true">
    <svg className="greek-temple" viewBox="0 0 680 270" fill="none">
      <path d="M66 78 340 10l274 68-12 16H78L66 78Z" fill="currentColor" fillOpacity=".08" />
      <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M66 78 340 10l274 68M78 94h524M88 104h504M98 116h484" />
        <path d="M108 122h464M112 126h456M112 199h456M106 207h468" />
        <path d="M126 126v69m12-69v69m8-69v69m12-69v69M226 126v69m12-69v69m8-69v69m12-69v69M318 126v69m12-69v69m8-69v69m12-69v69M410 126v69m12-69v69m8-69v69m12-69v69M510 126v69m12-69v69m8-69v69m12-69v69" />
        <path d="M118 122h44m-44 73h44M218 122h44m-44 73h44M310 122h44m-44 73h44M402 122h44m-44 73h44M502 122h44m-44 73h44" />
        <path d="M94 216h492M84 226h512M72 238h536M58 250h564" />
        <path d="M340 10v15m-6-3h12" strokeWidth="1.5" />
      </g>
      <path d="M98 116h484v7H98zM112 199h456v6H112z" fill="currentColor" fillOpacity=".14" />
    </svg>
  </div>
);

export const GreekLaurel: React.FC = () => (
  <svg className="greek-laurel" viewBox="0 0 96 52" fill="none" aria-hidden="true">
    <g fill="currentColor">
      <path d="M46 45C30 41 18 28 13 8c9 5 15 12 18 20 4 7 9 12 15 14z" />
      <path d="M42 39c-9 0-16-5-20-13 8 0 14 3 19 9z" />
      <path d="M34 30c-8-2-13-8-15-16 7 2 12 6 15 12z" />
      <path d="M50 45c16-4 28-17 33-37-9 5-15 12-18 20-4 7-9 12-15 14z" />
      <path d="M54 39c9 0 16-5 20-13-8 0-14 3-19 9z" />
      <path d="M62 30c8-2 13-8 15-16-7 2-12 6-15 12z" />
    </g>
    <path d="M46 46c1 2 2 3 2 4m2-4c-1 2-2 3-2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const GreekLightning: React.FC = () => (
  <svg className="greek-bolt" viewBox="0 0 20 28" fill="none" aria-hidden="true">
    <path d="M11.5 1 3 15h5.5L7.5 27 17 11.5h-5.5L11.5 1Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
  </svg>
);
