import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import Constants from 'expo-constants';
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
import { Platform } from 'react-native';

import { useAuth } from '@/state/auth';
import { useCameras } from '@/state/cameras';

/**
 * Alerts that arrive while the app is shut.
 *
 * A notification about a camera has one job: land the person on that camera,
 * playing, in one tap. No intermediate list, and no re-authentication when the
 * session is still good. That is what this does.
 *
 * Three ways in, all of which end at `routeTo`:
 *
 *   - tapped while the app is running        (response listener)
 *   - tapped while the app was shut          (the last response, read on boot)
 *   - arrived while the app is in front      (shown, not routed; the person
 *                                             decides whether to leave what
 *                                             they are doing)
 *
 * TBD (backend): nothing registers this device with a service yet, because no
 * endpoint exists to register it with. What is needed is a POST that stores
 * `{ token, platform }` against the signed-in user, and a sender that puts
 * `camera_id` (and `alert_id` where there is one) in the notification's data.
 * `token` below is exposed on App settings so it can be read during that work.
 */

/** Data a notification carries. Every field optional: this is someone else's payload. */
type Payload = {
  cameraId?: string;
  alertId?: string;
};

type NotificationsValue = {
  /** 'granted' | 'denied' | 'undetermined', or null before it has been checked. */
  permission: Notifications.PermissionStatus | null;
  /** The push token for this install, once permission allows one. */
  token: string | null;
  /** Which kind of token `token` is, which is what a backend needs to know. */
  tokenKind: 'expo' | 'device' | null;
  /** Asks for permission. Safe to call more than once. */
  request: () => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/** Shown as a heads-up banner rather than collected silently: these are alerts. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const { select, status: camerasStatus } = useCameras();

  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenKind, setTokenKind] = useState<'expo' | 'device' | null>(null);

  // A tap can arrive before the router or the session is ready. Hold it and
  // apply it once both are, rather than dropping it or racing the redirect.
  const pending = useRef<Payload | null>(null);

  const routeTo = useCallback(
    (payload: Payload) => {
      if (authStatus !== 'signedIn') {
        pending.current = payload;
        return;
      }
      if (payload.cameraId) {
        select(payload.cameraId);
        router.push('/(tabs)/live');
        return;
      }
      // No camera on the payload, so the alert list is the honest destination.
      router.push('/(tabs)/alerts');
    },
    [authStatus, select],
  );

  useEffect(() => {
    if (authStatus !== 'signedIn' || !pending.current) return;
    const payload = pending.current;
    pending.current = null;
    routeTo(payload);
  }, [authStatus, routeTo]);

  // Android needs a channel before anything can be shown heads-up.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void Notifications.setNotificationChannelAsync('alerts', {
      name: 'Camera alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4AF37',
    });
  }, []);

  // A tap while the app is running.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeTo(payloadOf(response.notification));
    });
    return () => sub.remove();
  }, [routeTo]);

  // A tap that started the app. Read once, on boot.
  useEffect(() => {
    let live = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!live || !response) return;
      routeTo(payloadOf(response.notification));
    });
    return () => {
      live = false;
    };
    // Boot only: re-running this on every routeTo change would re-open the
    // same notification each time the session settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acquire = useCallback(async (status: Notifications.PermissionStatus) => {
    setPermission(status);
    if (status !== 'granted') return;
    // Expo's token where the project is known, the platform's own otherwise.
    // A backend can send to either; it just has to be told which it has.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
    try {
      const expo = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      setToken(expo.data);
      setTokenKind('expo');
      return;
    } catch {
      // Falls through to the native token below.
    }
    try {
      const device = await Notifications.getDevicePushTokenAsync();
      setToken(String(device.data));
      setTokenKind('device');
    } catch {
      // No token available on this build. Notifications simply stay off.
    }
  }, []);

  const request = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    await acquire(status);
    return status === 'granted';
  }, [acquire]);

  /**
   * Asked for only once this account has actually seen something.
   *
   * A permission sheet on the first launch, before any camera has appeared, is
   * a decision demanded from someone who does not yet know what the app is
   * for, and the usual answer to that is no, permanently. Waiting until the
   * camera list has loaded costs nothing and asks at a point where the
   * question makes sense.
   */
  useEffect(() => {
    if (authStatus !== 'signedIn' || camerasStatus !== 'ready') return;
    let live = true;
    void (async () => {
      const current = await Notifications.getPermissionsAsync();
      if (!live) return;
      if (current.status === 'granted') return acquire(current.status);
      setPermission(current.status);
      if (!current.canAskAgain) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (live) await acquire(status);
    })();
    return () => {
      live = false;
    };
  }, [authStatus, camerasStatus, acquire]);

  const value = useMemo<NotificationsValue>(
    () => ({ permission, token, tokenKind, request }),
    [permission, token, tokenKind, request],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider.');
  return value;
}

/**
 * The camera and alert a notification is about.
 *
 * Written tolerantly on purpose: the sender does not exist yet, so this
 * accepts the spellings it is most likely to use rather than committing the
 * app to one that then turns out to be wrong.
 */
function payloadOf(notification: Notifications.Notification): Payload {
  const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'string' && value) return value;
    }
    return undefined;
  };
  return {
    cameraId: pick('cameraId', 'camera_id', 'cameraID'),
    alertId: pick('alertId', 'alert_id', 'alertID'),
  };
}
