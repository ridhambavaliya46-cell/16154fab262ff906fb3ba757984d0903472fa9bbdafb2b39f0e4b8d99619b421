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
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    const instance = new Lenis({
      // A lower interpolation keeps wheel movement gliding between inputs so
      // the smooth-scroll effect is perceptible without making the page sluggish.
      lerp: 0.075,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      anchors: true,
      // Native touch scrolling: Lenis' synced touch animation was a common
      // source of jank on mobile devices and buys nothing on desktop.
      syncTouch: false,
    });

    lenisRef.current = instance;
    setLenis(instance);
    document.documentElement.classList.add('lenis', 'lenis-smooth');

    let rafId: number;
    const raf = (time: number) => {
      instance.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      instance.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  }, [setLenis]);

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
