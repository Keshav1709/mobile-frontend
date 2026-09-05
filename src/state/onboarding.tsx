import { createContext, ReactNode, useContext, useMemo, useRef, useState } from 'react';

import { FoundCamera } from '@/onvif/scan';
import { Credentials } from '@/onvif/soap';

/**
 * State for one camera-onboarding run.
 *
 * Credentials live in a ref for the length of the flow and are cleared by
 * `clear()`. They are never written to storage, a URL, or a log.
 */
type OnboardingValue = {
  camera: FoundCamera | null;
  select: (camera: FoundCamera) => void;
  setCredentials: (credentials: Credentials) => void;
  /** Reads the credentials once, for the connect attempt. */
  takeCredentials: () => Credentials;
  clear: () => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [camera, setCamera] = useState<FoundCamera | null>(null);
  const credentials = useRef<Credentials | null>(null);

  const value = useMemo<OnboardingValue>(
    () => ({
      camera,
      select: setCamera,
      setCredentials: (next) => {
        credentials.current = next;
      },
      takeCredentials: () => {
        if (!credentials.current) throw new Error('Camera credentials are missing.');
        return credentials.current;
      },
      clear: () => {
        credentials.current = null;
        setCamera(null);
      },
    }),
    [camera],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider.');
  return value;
}
