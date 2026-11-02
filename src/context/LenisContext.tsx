import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Lenis from 'lenis';

type ScrollOptions = { offset?: number; duration?: number; immediate?: boolean };

interface LenisContextType {
  lenis: Lenis | null;
  scrollTo: (target: string | number | HTMLElement, options?: ScrollOptions) => void;
}

const LenisContext = createContext<LenisContextType>({
  lenis: null,
  scrollTo: () => {},
});

export const LenisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lenisRef = useRef<Lenis | null>(null);
  // Exposed as state so consumers re-render when the instance becomes ready.
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let instance: Lenis | null = null;
    let rafId: number | null = null;

    const stop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      instance?.destroy();
      instance = null;
      lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
      setLenis(null);
    };

    const start = () => {
      if (motionPreference.matches || instance) return;
      const active = new Lenis({
        lerp: 0.075,
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.5,
        anchors: true,
        syncTouch: false,
        autoRaf: false,
      });
      instance = active;
      lenisRef.current = active;
      setLenis(active);
      document.documentElement.classList.add('lenis', 'lenis-smooth');

      const tick = (time: number) => {
        if (instance !== active) return;
        active.raf(time);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    const syncMotionPreference = () => {
      if (motionPreference.matches) stop();
      else start();
    };

    start();
    motionPreference.addEventListener('change', syncMotionPreference);

    return () => {
      motionPreference.removeEventListener('change', syncMotionPreference);
      if (rafId !== null) cancelAnimationFrame(rafId);
      instance?.destroy();
      instance = null;
      lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  }, []);

  // Stable identity so consumers (Navbar) stop re-rendering on every provider render.
  const scrollTo = useCallback((target: string | number | HTMLElement, options?: ScrollOptions) => {
    const active = lenisRef.current;
    if (active) {
      active.scrollTo(target, options);
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = options?.immediate || reducedMotion ? 'auto' : 'smooth';
    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior });
    } else if (typeof target === 'string') {
      document.querySelector(target)?.scrollIntoView({ behavior });
    } else {
      target.scrollIntoView({ behavior });
    }
  }, []);

  const value = useMemo<LenisContextType>(() => ({ lenis, scrollTo }), [lenis, scrollTo]);

  return <LenisContext.Provider value={value}>{children}</LenisContext.Provider>;
};

export const useLenisScroll = () => useContext(LenisContext);
