"use client";
import { motion, AnimatePresence } from "motion/react";

const EASE: [number, number, number, number] = [0.59, 0, 0.35, 1];
const ENTER = 0.45;
const EXIT  = 0.25;

interface Props {
  active: boolean;
}

/**
 * Full-screen warp flash that plays over page transitions.
 * Adapts the WarpDialog blob animation with Vyso's orange palette.
 */
export function WarpTransitionOverlay({ active }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="warp-overlay"
          style={{
            position:      "fixed",
            inset:         0,
            zIndex:        9000,
            pointerEvents: "none",
            overflow:      "hidden",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0, transition: { duration: EXIT, ease: EASE } }}
          transition={{ duration: 0.15, ease: EASE }}
        >
          {/* ── Expanding sphere — rises from bottom-centre ────────────── */}
          <motion.div
            style={{
              position:     "absolute",
              borderRadius: "50%",
              height:       "50%",
              width:        "50%",
              filter:       "blur(50px)",
              left:         "25%",
              top:          "100%",
              willChange:   "transform",
            }}
            initial={{ scale: 0,  opacity: 1,   backgroundColor: "hsl(30,82%,77%)" }}
            animate={{ scale: 10, opacity: 0.22, backgroundColor: "hsl(22,69%,44%)" }}
            exit={{    scale: 0,  opacity: 1,   backgroundColor: "hsl(30,82%,77%)",
              transition: { duration: EXIT }
            }}
            transition={{ duration: ENTER, ease: EASE }}
          />

          {/* ── Left amber blob ────────────────────────────────────────── */}
          <motion.div
            style={{
              position:     "absolute",
              borderRadius: "50%",
              filter:       "blur(100px)",
              background:   "hsl(30,82%,57%)",
              height:       "100%",
              width:        "100%",
              top:          "-25%",
              left:         "-50%",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{    opacity: 0, transition: { duration: EXIT } }}
            transition={{ duration: ENTER, ease: EASE }}
          />

          {/* ── Right deep-orange blob ─────────────────────────────────── */}
          <motion.div
            style={{
              position:     "absolute",
              borderRadius: "50%",
              filter:       "blur(100px)",
              background:   "hsl(14,72%,36%)",
              width:        "100%",
              height:       "100%",
              top:          "25%",
              left:         "50%",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{    opacity: 0, transition: { duration: EXIT } }}
            transition={{ duration: ENTER, ease: EASE }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
