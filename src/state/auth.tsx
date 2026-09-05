import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
} from 'firebase/auth';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cloudApi } from '@/api/cloud';
import { RequestError } from '@/api/errors';
import { firebaseAuth, firebaseEnabled, googleClientIds } from '@/api/firebase';
import { UserProfile } from '@/api/types';
import { RecaptchaHandle, RecaptchaModal } from '@/components/RecaptchaModal';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'zeroforg.id_token';

/** Google needs both Firebase and an OAuth client id for the running platform. */
const googleConfigured =
  firebaseEnabled &&
  Boolean(
    googleClientIds.webClientId ||
      googleClientIds.iosClientId ||
      googleClientIds.androidClientId,
  );

type Prompt = () => Promise<unknown>;

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthValue = {
  status: Status;
  user: UserProfile | null;
  idToken: string | null;
  /** True when no Firebase project is configured and sign-in is simulated. */
  developmentMode: boolean;
  googleReady: boolean;
  /** Re-reads the profile after it changes server-side. */
  refreshUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendOtp: (phoneNumber: string) => Promise<void>;
  confirmOtp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [googlePrompt, setGooglePrompt] = useState<Prompt | null>(null);

  const recaptcha = useRef<RecaptchaHandle>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const devPhone = useRef<string | null>(null);
  const googlePending =
    useRef<{ resolve: () => void; reject: (e: Error) => void } | undefined>(undefined);

  const establish = useCallback(async (token: string) => {
    const { user: profile } = await cloudApi.createSession(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setIdToken(token);
    setUser(profile);
    setStatus('signedIn');
  }, []);

  // Restore a previous session, dropping it if the registry no longer accepts it.
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) return setStatus('signedOut');
      try {
        setUser(await cloudApi.me(stored));
        setIdToken(stored);
        setStatus('signedIn');
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setStatus('signedOut');
      }
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!idToken) return;
    setUser(await cloudApi.me(idToken));
  }, [idToken]);

  const settleGoogle = useCallback((error?: Error) => {
    const pending = googlePending.current;
    googlePending.current = undefined;
    if (error) pending?.reject(error);
    else pending?.resolve();
  }, []);

  const onGoogleToken = useCallback(
    async (token: string) => {
      try {
        await establish(token);
        settleGoogle();
      } catch {
        settleGoogle(signInFailed());
      }
    },
    [establish, settleGoogle],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!googleConfigured) return establish(devToken({ provider: 'google.com' }));
    const prompt = googlePrompt;
    if (!prompt) throw signInFailed();
    await new Promise<void>((resolve, reject) => {
      googlePending.current = { resolve, reject };
      prompt().catch(() => settleGoogle(signInFailed()));
    });
  }, [establish, googlePrompt, settleGoogle]);

  const sendOtp = useCallback(async (phoneNumber: string) => {
    if (!firebaseEnabled) {
      devPhone.current = phoneNumber;
      return;
    }
    const verifier = recaptcha.current;
    if (!verifier) throw signInFailed();
    try {
      confirmation.current = await signInWithPhoneNumber(firebaseAuth(), phoneNumber, verifier);
    } catch {
      throw new RequestError({
        code: 'OTP_SEND_FAILED',
        message: "We couldn't send a code to that number. Check it and try again.",
      });
    }
  }, []);

  const confirmOtp = useCallback(
    async (code: string) => {
      if (!firebaseEnabled) {
        if (code.length !== 6) throw invalidCode();
        return establish(devToken({ provider: 'phone', phoneNumber: devPhone.current }));
      }
      if (!confirmation.current) throw signInFailed();
      try {
        const result = await confirmation.current.confirm(code);
        await establish(await result.user.getIdToken());
      } catch {
        throw invalidCode();
      }
    },
    [establish],
  );

  const holdPrompt = useCallback((prompt: Prompt) => setGooglePrompt(() => prompt), []);
  const cancelGoogle = useCallback(() => settleGoogle(signInFailed()), [settleGoogle]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    confirmation.current = null;
    setIdToken(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      idToken,
      developmentMode: !firebaseEnabled,
      googleReady: !googleConfigured || !!googlePrompt,
      refreshUser,
      signInWithGoogle,
      sendOtp,
      confirmOtp,
      signOut,
    }),
    [
      status,
      user,
      idToken,
      googlePrompt,
      refreshUser,
      signInWithGoogle,
      sendOtp,
      confirmOtp,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {googleConfigured ? (
        <GoogleSignIn onPrompt={holdPrompt} onToken={onGoogleToken} onCancel={cancelGoogle} />
      ) : null}
      {firebaseEnabled ? <RecaptchaModal ref={recaptcha} /> : null}
    </AuthContext.Provider>
  );
}

/**
 * `Google.useAuthRequest` throws unless an OAuth client id exists for the
 * running platform, so it is mounted only when Google is configured. Sign-in
 * returns through a redirect, which this reports back as a Firebase ID token.
 */
function GoogleSignIn({
  onPrompt,
  onToken,
  onCancel,
}: {
  onPrompt: (prompt: Prompt) => void;
  onToken: (idToken: string) => void;
  onCancel: () => void;
}) {
  const [request, response, prompt] = Google.useAuthRequest(googleClientIds);

  useEffect(() => {
    if (request) onPrompt(prompt);
  }, [request, prompt, onPrompt]);

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success' || !response.params.id_token) return onCancel();
    signInWithCredential(
      firebaseAuth(),
      GoogleAuthProvider.credential(response.params.id_token),
    )
      .then((result) => result.user.getIdToken())
      .then(onToken)
      .catch(onCancel);
  }, [response, onToken, onCancel]);

  return null;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

const signInFailed = () =>
  new RequestError({ code: 'SIGN_IN_FAILED', message: "We couldn't sign you in. Try again." });

const invalidCode = () =>
  new RequestError({ code: 'INVALID_CODE', message: 'That code is not correct. Try again.' });

/**
 * Development mode only: an unsigned token carrying the same claims Firebase
 * would send. The cloud registry accepts these while CLOUD_ENV is not
 * "production", so the app is usable before a Firebase project exists.
 */
function devToken({ provider, phoneNumber }: { provider: string; phoneNumber?: string | null }) {
  const claims = {
    user_id: `dev_${provider === 'phone' ? (phoneNumber ?? 'phone').replace(/\D/g, '') : 'google'}`,
    email: provider === 'google.com' ? 'dev@zeroforg.local' : undefined,
    phone_number: phoneNumber ?? undefined,
    name: provider === 'phone' ? phoneNumber : 'Development User',
    firebase: { sign_in_provider: provider },
  };
  return `${base64Url('{"alg":"none"}')}.${base64Url(JSON.stringify(claims))}.dev`;
}

function base64Url(value: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = Array.from(new TextEncoder().encode(value));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const size = bytes.length - i;
    out += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63];
    if (size > 1) out += chars[(chunk >> 6) & 63];
    if (size > 2) out += chars[chunk & 63];
  }
  return out;
}
