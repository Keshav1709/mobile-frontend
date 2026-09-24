import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
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
import { fetchManifest } from '@/api/console';
import { RequestError } from '@/api/errors';
import { firebaseAuth, firebaseEnabled, googleClientIds } from '@/api/firebase';
import { UserProfile } from '@/api/types';
import { cacheKey, clearCache, readCache, writeCache } from '@/lib/cache';

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
  /**
   * The registry (the app's own small service, on a LAN or tailnet address) could not
   * be reached, so this session was established from the dashboard alone. Everything
   * the dashboard serves works; the profile's app-only fields (camera type, date of
   * birth) are unavailable until it is back.
   */
  registryOffline: boolean;
  /**
   * The registry is a read-only view of the ZeroForg dashboard: it can show
   * everything and change nothing. Screens use this to drop edit controls
   * rather than offer buttons whose only outcome is a refusal.
   */
  readOnly: boolean;
  /**
   * A stored session could not be restored because nothing could be reached,
   * and there was no cached profile to fall back on. The token has been kept,
   * so the next launch with a network signs the person straight back in. The
   * sign-in screen says so rather than letting it look like a lost account.
   */
  offlineHold: boolean;
  /** Google sign-in can be offered: Firebase plus a native OAuth client id, or development mode. */
  googleAvailable: boolean;
  googleReady: boolean;
  /**
   * A currently-valid ID token.
   *
   * `idToken` above is the one captured at sign-in and it expires after an hour, so
   * anything that calls a service must go through this instead: Firebase refreshes
   * silently when the cached token is close to expiry. Falls back to the stored token
   * in development mode, where there is no Firebase to ask.
   */
  getToken: () => Promise<string | null>;
  /** Re-reads the profile after it changes server-side. */
  refreshUser: () => Promise<void>;
  /**
   * Email + password against the same Firebase project as the dashboard.
   * Accounts are created on the dashboard; the app only signs them in.
   */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  // Assume read-only until the registry says otherwise: showing an edit
  // control that then fails is worse than briefly hiding one that works.
  const [readOnly, setReadOnly] = useState(true);
  const [registryOffline, setRegistryOffline] = useState(false);
  const [offlineHold, setOfflineHold] = useState(false);

  useEffect(() => {
    let live = true;
    cloudApi
      .config()
      .then((config) => {
        if (live) setReadOnly(!!config.read_only);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const [googlePrompt, setGooglePrompt] = useState<Prompt | null>(null);

  const googlePending =
    useRef<{ resolve: () => void; reject: (e: Error) => void } | undefined>(undefined);

  /**
   * The profile for a token: the registry's if it answers, else one assembled from
   * the dashboard's manifest.
   *
   * The registry sits on a LAN or tailnet address that moves; the dashboard is public.
   * A registry that cannot be reached must not stop someone whose account the
   * dashboard vouches for from signing in — but a registry that *refuses* (no such
   * account) is a real answer and is kept. Only transport failures fall through.
   */
  const profileFor = useCallback(async (token: string, restore: boolean): Promise<UserProfile> => {
    try {
      const profile = restore ? await cloudApi.me(token) : (await cloudApi.createSession(token)).user;
      setRegistryOffline(false);
      return profile;
    } catch (cause) {
      if (!(cause instanceof RequestError) || !TRANSPORT_FAILURES.has(cause.code)) throw cause;
      let manifest;
      try {
        manifest = (await fetchManifest(token)).manifest;
      } catch {
        // Neither service answered: report the registry's failure, which is the
        // one whose message says "check your connection".
        throw cause;
      }
      setRegistryOffline(true);
      return profileFromManifest(manifest);
    }
  }, []);

  const establish = useCallback(async (token: string) => {
    const profile = await profileFor(token, false);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    void writeCache(cacheKey.profile, profile);
    setIdToken(token);
    setUser(profile);
    setOfflineHold(false);
    setStatus('signedIn');
  }, [profileFor]);

  /**
   * Restore a previous session.
   *
   * The distinction that matters here is between a service that REFUSED this
   * token and a service that could not be REACHED. A refusal is a real answer
   * and the session is over. Being unreachable is not an answer at all, and
   * the token is very probably still good: this is a phone on factory wifi,
   * and dropping the session every time the link is bad is how someone ends up
   * retyping a password at the one moment they need to see a camera.
   *
   * So an unreachable service falls back to the last profile this device
   * cached, and the token is kept either way.
   */
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) return setStatus('signedOut');
      try {
        const profile = await profileFor(stored, true);
        void writeCache(cacheKey.profile, profile);
        setUser(profile);
        setIdToken(stored);
        setOfflineHold(false);
        setStatus('signedIn');
      } catch (cause) {
        const unreachable =
          cause instanceof RequestError && TRANSPORT_FAILURES.has(cause.code);
        if (!unreachable) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await clearCache();
          setStatus('signedOut');
          return;
        }
        const cached = await readCache<UserProfile>(cacheKey.profile);
        if (cached) {
          setUser(cached.data);
          setIdToken(stored);
          setRegistryOffline(true);
          setStatus('signedIn');
          return;
        }
        // Nothing cached, so this device has never completed a sign-in while
        // online. The token stays put for the next launch that has a network.
        setOfflineHold(true);
        setStatus('signedOut');
      }
    })();
  }, [profileFor]);

  const getToken = useCallback(async () => {
    if (!firebaseEnabled) return idToken;
    const current = firebaseAuth().currentUser;
    if (!current) return idToken;
    try {
      const fresh = await current.getIdToken();
      // Keep the stored copy current so a cold start restores a usable session.
      if (fresh && fresh !== idToken) {
        setIdToken(fresh);
        SecureStore.setItemAsync(TOKEN_KEY, fresh).catch(() => undefined);
      }
      return fresh;
    } catch {
      // A refresh that fails (revoked, offline) is not worth throwing over here —
      // the call that follows will fail with a message the screen can show.
      return idToken;
    }
  }, [idToken]);

  // Firebase ID tokens last an hour. Every screen still holds `idToken` for its
  // requests, so keep that copy fresh on a timer and whenever the app comes back to
  // the foreground — otherwise the first tap after a long pause is a 401 and a
  // "sign in again" that nobody asked for.
  useEffect(() => {
    if (status !== 'signedIn' || !firebaseEnabled) return;
    const refresh = () => void getToken();
    const timer = setInterval(refresh, 30 * 60 * 1000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status, getToken]);

  const refreshUser = useCallback(async () => {
    if (!idToken) return;
    const profile = await profileFor(idToken, true);
    void writeCache(cacheKey.profile, profile);
    setUser(profile);
  }, [idToken, profileFor]);

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

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const address = email.trim().toLowerCase();
      if (!firebaseEnabled) {
        // Development mode only: no Firebase at all, so a local token stands in.
        return establish(devToken({ provider: 'password', email: address }));
      }
      let token: string;
      try {
        const result = await signInWithEmailAndPassword(firebaseAuth(), address, password);
        token = await result.user.getIdToken();
      } catch (cause) {
        throw emailAuthError(cause);
      }
      await establish(token);
    },
    [establish],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseEnabled) return establish(devToken({ provider: 'google.com' }));
    if (!googleConfigured) throw signInFailed();
    const prompt = googlePrompt;
    if (!prompt) throw signInFailed();
    await new Promise<void>((resolve, reject) => {
      googlePending.current = { resolve, reject };
      prompt().catch(() => settleGoogle(signInFailed()));
    });
  }, [establish, googlePrompt, settleGoogle]);

  const holdPrompt = useCallback((prompt: Prompt) => setGooglePrompt(() => prompt), []);
  const cancelGoogle = useCallback(() => settleGoogle(signInFailed()), [settleGoogle]);

  /** Signs out and returns to the sign-in screen. */
  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // Everything cached belongs to the account that is leaving.
    await clearCache();
    setIdToken(null);
    setOfflineHold(false);
    setUser(null);
    setStatus('signedOut');
    router.replace('/sign-in');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      idToken,
      developmentMode: !firebaseEnabled,
      registryOffline,
      readOnly,
      offlineHold,
      googleAvailable: !firebaseEnabled || googleConfigured,
      googleReady: !firebaseEnabled || (googleConfigured && !!googlePrompt),
      getToken,
      refreshUser,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [
      status,
      user,
      idToken,
      registryOffline,
      readOnly,
      offlineHold,
      googlePrompt,
      getToken,
      refreshUser,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {googleConfigured ? (
        <GoogleSignIn onPrompt={holdPrompt} onToken={onGoogleToken} onCancel={cancelGoogle} />
      ) : null}
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

/** Errors that mean "the registry did not answer", as opposed to "it said no". */
const TRANSPORT_FAILURES = new Set(['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR', 'DATABASE_UNREACHABLE']);

/**
 * A profile from the manifest alone. Everything the app needs to run comes from the
 * dashboard; the fields left null are the registry's own (`mobile_profiles`) and the
 * profile screen says so while `registryOffline` is set.
 */
function profileFromManifest(manifest: Awaited<ReturnType<typeof fetchManifest>>['manifest']): UserProfile {
  return {
    user_id: manifest.user.id,
    tenant_id: manifest.org.id,
    tenant_name: manifest.org.name,
    tenant_slug: manifest.org.slug,
    features: manifest.enabled_keys ?? [],
    email: manifest.user.email ?? null,
    phone_number: null,
    display_name: null,
    first_name: null,
    last_name: null,
    date_of_birth: null,
    camera_type: null,
    auth_provider: 'password',
    created_at: null,
    // Not a first run: the account exists on the dashboard, which is what these flags
    // gate. Sending someone back through onboarding because a side service was down
    // would be the wrong lesson to draw from the outage.
    profile_completed: true,
    onboarding_completed: true,
  };
}

const signInFailed = () =>
  new RequestError({ code: 'SIGN_IN_FAILED', message: "We couldn't sign you in. Try again." });

/**
 * A wrong address and a wrong password are deliberately the same message:
 * saying which of the two was wrong tells an unauthenticated caller whether
 * the account exists.
 */
const invalidCredentials = () =>
  new RequestError({
    code: 'INVALID_SIGN_IN',
    message: 'Incorrect email or password. Please try again.',
  });

/** The dashboard's Firebase error mapping for sign-in, verbatim. */
function emailAuthError(cause: unknown): RequestError {
  const code = (cause as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-email')
    return new RequestError({ code: 'INVALID_EMAIL', message: 'Invalid email address' });
  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    // Older Firebase builds spell the same refusal this way.
    code === 'auth/invalid-login-credentials'
  )
    return invalidCredentials();
  if (code === 'auth/network-request-failed')
    // Not a credential problem, and saying so sends people to retype a
    // password that was right all along.
    return new RequestError({
      code: 'NETWORK_ERROR',
      message: "We couldn't reach the service. Check your connection and try again.",
    });
  if (code === 'auth/too-many-requests')
    return new RequestError({
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Try again in a few minutes.',
    });
  if (code === 'auth/user-disabled')
    return new RequestError({
      code: 'ACCOUNT_DISABLED',
      message: 'This account has been disabled. Contact your administrator.',
    });
  return new RequestError({ code: 'AUTH_FAILED', message: 'Failed to sign in. Please try again.' });
}

/**
 * Development mode only: an unsigned token carrying the same claims Firebase
 * would send. The registry accepts these only while CLOUD_ENV is not
 * "production".
 */
function devToken({ provider, email }: { provider: string; email?: string }) {
  const userId =
    provider === 'password'
      ? `dev_${(email ?? 'email').replace(/[^a-z0-9]/gi, '_')}`
      : 'dev_google';
  const claims = {
    user_id: userId,
    email: provider === 'google.com' ? 'dev@zeroforg.local' : email,
    name: provider === 'password' ? email : 'Development User',
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
