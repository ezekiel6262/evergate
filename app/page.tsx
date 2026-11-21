'use client';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRoute, View } from '@/lib/route';
import { HomeView } from '@/components/views/HomeView';
import { GateView } from '@/components/views/GateView';
import { SetupView } from '@/components/views/SetupView';
import { GuardianView } from '@/components/views/GuardianView';
import { HeirView } from '@/components/views/HeirView';
import { PublicView } from '@/components/views/PublicView';
import { FilmView } from '@/components/views/FilmView';

const map: Record<View, () => JSX.Element> = {
  home: HomeView, gate: GateView, setup: SetupView, guardian: GuardianView, heir: HeirView, public: PublicView, film: FilmView,
};

export default function Router() {
  const { view, anchor } = useRoute();
  const reduce = useReducedMotion();
  const prev = useRef<View | null>(null);
  const changed = prev.current !== null && prev.current !== view;

  useEffect(() => {
    if (anchor) {
      let tries = 0;
      const seek = () => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        else if (tries++ < 30) setTimeout(seek, 100);
      };
      setTimeout(seek, changed ? 450 : 0);
    } else if (prev.current !== view) {
      window.scrollTo(0, 0);
    }
    prev.current = view;
  }, [view, anchor, changed, reduce]);

  const V = map[view];
  return (
    <>
      {/* Page transition: a pine dome sinks away like a gate swinging open. */}
      {!reduce && (
        <motion.div key={'veil-' + view} aria-hidden
          initial={{ clipPath: 'circle(150% at 50% 100%)' }} animate={{ clipPath: 'circle(0% at 50% 100%)' }}
          transition={{ duration: 0.75, ease: [0.7, 0, 0.2, 1] }}
          style={{ position: 'fixed', inset: 0, background: 'var(--pine)', zIndex: 100, pointerEvents: 'none' }} />
      )}
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.45, delay: reduce ? 0 : 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
          <V />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
