import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import { Icon } from '@/components/Icon';
import { agoLabel, cacheKey, readCache, writeCache } from '@/lib/cache';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

/**
 * One camera's picture, on a list.
 *
 * Home used to describe cameras in words: manufacturer, model, IP, resolution.
 * None of that answers the question someone opens this app to ask, which is
 * what the camera can see. This shows that, and shows it in two steps so the
 * list is never a column of grey boxes:
 *
 *   1. The frame this phone last painted for the camera, from the image cache,
 *      which needs no network and appears on the first render.
 *   2. One fresh frame, requested on mount.
 *
 * Deliberately one frame and not a stream. A list of eight cameras polling on
 * a timer is eight requests every couple of seconds over site wifi, for a
 * picture the size of a stamp. The Live screen is where a camera plays.
 */

/** A frame older than this says so rather than pretending to be current. */
const STALE_AFTER_MS = 2 * 60 * 1000;
/** Beyond this it is not worth showing at all. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function CameraThumb({ cameraId, online }: { cameraId: string; online: boolean }) {
  const { color } = useTheme();
  const { idToken, getToken } = useAuth();
  const { orgId } = useConsole();

  const [uri, setUri] = useState<string | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const token = (await getToken()) ?? idToken;
      if (live && token) setHeaders(dashboardApi.frameHeaders(token));
    })();
    return () => {
      live = false;
    };
  }, [idToken, getToken, orgId]);

  // Whatever this phone already has, before asking for anything.
  useEffect(() => {
    let live = true;
    (async () => {
      const cached = await readCache<string>(cacheKey.frame(cameraId));
      if (!live || !cached || Date.now() - cached.at > MAX_AGE_MS) return;
      setUri(cached.data);
      setAt(cached.at);
    })();
    return () => {
      live = false;
    };
  }, [cameraId]);

  // Then one current frame.
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    if (!headers || !online) return;
    setFresh(dashboardApi.frameUrl(cameraId));
  }, [cameraId, headers, online]);

  const stale = at !== null && Date.now() - at > STALE_AFTER_MS;

  return (
    <View style={[styles.frame, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}>
      {uri && headers ? (
        <Image source={{ uri, headers }} style={styles.fill} resizeMode="cover" />
      ) : null}

      {/* Loads out of sight and is promoted only once it has decoded, so the
          card never flashes empty between the saved frame and the new one. */}
      {fresh && headers && fresh !== uri ? (
        <Image
          source={{ uri: fresh, headers }}
          style={[styles.fill, styles.hidden]}
          onLoad={() => {
            setUri(fresh);
            setAt(Date.now());
            setFailed(false);
            void writeCache(cacheKey.frame(cameraId), fresh);
          }}
          onError={() => setFailed(true)}
        />
      ) : null}

      {!uri ? (
        <View style={styles.centre}>
          <Icon name={failed || !online ? 'offline' : 'camera'} size={20} color={color.textFaint} />
          <Text style={[font.caption, { color: color.textFaint }]}>
            {!online ? 'No stream' : failed ? 'No picture yet' : 'Loading'}
          </Text>
        </View>
      ) : null}

      {uri && stale ? (
        <View style={[styles.stamp, { backgroundColor: color.glassBorder }]}>
          <Text style={[font.monoSmall, { color: color.white }]}>{agoLabel(at)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hidden: { opacity: 0 },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  stamp: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
