'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeatureKey } from '@/lib/platform/types';
import { FinchMark } from '@/components/platform/finch/FinchMark';
import { StageProfile } from './StageProfile';
import { StageModules } from './StageModules';
import { StageData } from './StageData';

export type OnboardingStage = 'profile' | 'modules' | 'data';

const STEPS: { stage: OnboardingStage; label: string }[] = [
  { stage: 'profile', label: 'Your business' },
  { stage: 'modules', label: 'Choose modules' },
  { stage: 'data', label: 'Bring your data' },
];

const ACCENT = '#1F5FA8';

/** Short, static Finch intro per stage (streaming chat only lives in stage 3). */
const INTRO: Record<OnboardingStage, { title: string; body: string }> = {
  profile: {
    title: "Hi, I'm Finch.",
    body: "I'll help you get Vyso set up in a few minutes. First, tell me a little about your business so I can tailor everything to you.",
  },
  modules: {
    title: 'Pick your toolkit.',
    body: 'Your 14-day trial includes Doc-U plus any 3 modules. Choose the three that match how you work — you can always change later.',
  },
  data: {
    title: "Let's bring your data in.",
    body: 'Upload a spreadsheet of customers or products, or drop in documents like invoices and price lists. Ask me anything as you go — or skip and do it later.',
  },
};

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <div key={s.stage} className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
              style={
                isCurrent
                  ? { backgroundColor: ACCENT, color: '#fff' }
                  : done
                    ? { backgroundColor: `${ACCENT}1A`, color: ACCENT }
                    : { backgroundColor: '#EEF1F5', color: '#A0A49C' }
              }
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className="hidden text-[12.5px] font-medium sm:inline"
              style={{ color: isCurrent ? '#171A17' : done ? ACCENT : '#A0A49C' }}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-1 h-px w-6 shrink-0" style={{ backgroundColor: done ? ACCENT : '#E4E9F0' }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** The persistent Finch presence — mark (re-draws on stage change) + intro copy. */
function FinchPanel({ stage }: { stage: OnboardingStage }) {
  const intro = INTRO[stage];
  return (
    <aside className="rounded-2xl border border-[#E4E9F0] bg-white p-6 lg:sticky lg:top-6 lg:h-fit">
      <span
        key={stage /* remount → replay the draw-in on each stage */}
        className="finch-gradient flex h-14 w-14 items-center justify-center rounded-2xl"
      >
        <FinchMark size={30} title="" animate="draw" />
      </span>
      <h2 className="of-display mt-4 text-[18px] font-semibold text-[#171A17]">{intro.title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[#6B6F68]">{intro.body}</p>
    </aside>
  );
}

export function OnboardingFlow({
  initialStage,
  defaultName,
  initialOrgName,
  email,
  initialChosenModules,
}: {
  initialStage: OnboardingStage;
  defaultName: string;
  initialOrgName: string;
  email: string;
  initialChosenModules: FeatureKey[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<OnboardingStage>(initialStage);
  const [orgName, setOrgName] = useState(initialOrgName);
  const [chosenModules, setChosenModules] = useState<FeatureKey[]>(initialChosenModules);

  const currentIndex = STEPS.findIndex((s) => s.stage === stage);

  function handleProfileDone(name: string) {
    setOrgName(name);
    setStage('modules');
    // Keep the server session truthful (the org now exists) for a refresh/return.
    router.refresh();
  }

  function handleModulesDone(keys: FeatureKey[]) {
    setChosenModules(keys);
    setStage('data');
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8">
        <StepIndicator current={currentIndex} />
      </div>

      {stage === 'data' ? (
        // Stage 3 owns its own split (Finch chat + upload), full width.
        <StageData orgName={orgName} email={email} chosenModules={chosenModules} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <FinchPanel stage={stage} />
          <div className="min-w-0 vyso-fade-in">
            {stage === 'profile' ? (
              <StageProfile defaultName={defaultName} onDone={handleProfileDone} />
            ) : (
              <StageModules onDone={handleModulesDone} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
