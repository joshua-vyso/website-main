'use client';

/**
 * Idle "thinking" indicator — three light-blue dots bouncing in sequence. Used
 * as the resting state of the Vyso AI chat and while a reply streams in.
 * Animation lives in globals.css (.vyso-ai-dot) and honours reduced-motion.
 */
export function BouncingDots({ size = 8, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label="Vyso AI is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="vyso-ai-dot inline-block rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: '#3E8FE0',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}
