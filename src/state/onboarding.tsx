import { createContext, ReactNode, useContext, useMemo, useRef, useState } from 'react';

import { Credentials } from '@/onvif/soap';

/** The camera being added, from either search path or manual entry. */
export type Target = {
  ip: string;
  port: number;
  serviceUrl: string;
  label: string;
  /** Set when the agent found it; lets the agent connect without re-scanning. */
  temporaryId?: string;
};

/**
 * State for one camera-onboarding run.
 *
 * Credentials live in a ref for the length of the flow and are cleared by
 * `clear()`. They are never written to a URL or a log, and reach storage only
 * when the phone is doing the connecting itself.
 */
type OnboardingValue = {
  target: Target | null;
  select: (target: Target) => void;
  setCredentials: (credentials: Credentials) => void;
  takeCredentials: () => Credentials;
  clear: () => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const credentials = useRef<Credentials | null>(null);

  const value = useMemo<OnboardingValue>(
    () => ({
      target,
      select: setTarget,
      setCredentials: (next) => {
        credentials.current = next;
      },
      takeCredentials: () => {
        if (!credentials.current) throw new Error('Camera credentials are missing.');
        return credentials.current;
      },
      clear: () => {
        credentials.current = null;
        setTarget(null);
      },
    }),
    [target],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider.');
  return value;
}
