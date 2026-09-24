import { useEffect, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { dashboardApi } from '@/api/dashboard';
import { Pill } from '@/components/Pill';
import { agoLabel, cacheKey, readCache, writeCache } from '@/lib/cache';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

/** Missed frames before the tile admits it has lost the camera. */
const FAIL_BEFORE_DOWN = 3;
/**
 * MJPEG must have painted within this, or the tile falls back to polling frames.
 *
 * This was eight seconds, which on a bad site link meant eight seconds of
 * nothing while a two-second frame was available the whole time. Waiting is
 * only worth it while it is plausibly about to work.
 */
const MJPEG_FIRST_PAINT_MS = 3500;

/** A frame older than this is not worth showing as a placeholder. */
const POSTER_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type Mode = 'probing' | 'mjpeg' | 'frames';

/** The last frame this phone painted for a camera, replayed from the image cache. */
type Poster = { uri: string; at: number };

/**
 * A camera, live, through the dashboard.
 *
 * Two ways to play it, chosen the way the web's Live wall chooses:
 *
 *   MJPEG   — where the site box runs go2rtc, the dashboard mints a signed URL and
 *             proxies the multipart stream through itself. Smooth, and no LAN needed.
 *             Rendered in a WebView, which paints multipart/x-mixed-replace natively.
 *
 *   Frames  — everywhere else: the newest annotated JPEG (detections burned in),
 *             polled at the interval the manifest sets. This is what production shows
 *             for NASSCOM today. Two <Image>s are kept and swapped only once the next
 *             frame has loaded, so the picture never blinks to blank between polls.
 *
 * Polling stops when the app leaves the foreground and resumes on return. A missed
 * frame keeps the last picture; three in a row mark the camera as lost.
 */
export function LiveStream({ cameraId }: { cameraId: string }) {
  const { idToken, getToken } = useAuth();
  const { manifest, orgId } = useConsole();

  const wantsMjpeg = Boolean(manifest?.live?.go2rtc);
  const intervalMs = Math.max(1000, manifest?.live?.frame_interval_ms ?? 2000);

  const [mode, setMode] = useState<Mode>(wantsMjpeg ? 'probing' : 'frames');
  const [mjpegUrl, setMjpegUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  // Headers a native image request must carry. Refreshed when the org or token changes.
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

  /**
   * The last frame this phone successfully painted for this camera, shown the
   * instant the tile mounts.
   *
   * Only the URL is stored. Each poll is cache-busted, so that exact URL is
   * unique and its bytes are already sitting in the platform image cache from
   * last time, which is what makes this paint immediately instead of waiting
   * on a request. A miss costs nothing: the tile falls back to its own
   * waiting state.
   */
  useEffect(() => {
    let live = true;
    setPoster(null);
    (async () => {
      const cached = await readCache<string>(cacheKey.frame(cameraId));
      if (!live || !cached) return;
      if (Date.now() - cached.at > POSTER_MAX_AGE_MS) return;
      setPoster({ uri: cached.data, at: cached.at });
    })();
    return () => {
      live = false;
    };
  }, [cameraId]);

  // Which way to play: ask for MJPEG once per camera; 409 (or any refusal) means
  // frames. Re-decided on a centre switch, since go2rtc is per site.
  useEffect(() => {
    let live = true;
    setMjpegUrl(null);
    if (!wantsMjpeg || !idToken) {
      setMode('frames');
      return;
    }
    setMode('probing');
    (async () => {
      const token = (await getToken()) ?? idToken;
      const signed = await dashboardApi.liveUrl(token, cameraId).catch(() => null);
      if (!live) return;
      if (signed) {
        setMjpegUrl(signed.url);
        setMode('mjpeg');
      } else {
        setMode('frames');
      }
    })();
    return () => {
      live = false;
    };
  }, [cameraId, wantsMjpeg, idToken, getToken, orgId]);

  if (mode === 'mjpeg' && mjpegUrl) {
    return (
      <MjpegPlayer
        url={mjpegUrl}
        poster={poster}
        headers={headers}
        onFail={() => {
          setMjpegUrl(null);
          setMode('frames');
        }}
      />
    );
  }
  return (
    <FramePlayer
      cameraId={cameraId}
      intervalMs={intervalMs}
      probing={mode === 'probing'}
      poster={poster}
      headers={headers}
    />
  );
}

function MjpegPlayer({
  url,
  poster,
  headers,
  onFail,
}: {
  url: string;
  poster: Poster | null;
  headers: Record<string, string> | null;
  onFail: () => void;
}) {
  const { color } = useTheme();
  const [painted, setPainted] = useState(false);

  // A WebView that never reports a load is a stream that never started.
  useEffect(() => {
    if (painted) return;
    const timer = setTimeout(onFail, MJPEG_FIRST_PAINT_MS);
    return () => clearTimeout(timer);
  }, [painted, onFail]);

  return (
    <View style={[styles.player, { borderColor: color.border, backgroundColor: color.surfaceSunken }]}>
      {/* The last frame, under the stream, so the tile is never blank while
          the picture negotiates. */}
      {!painted && poster && headers ? (
        <Image source={{ uri: poster.uri, headers }} style={styles.fill} resizeMode="contain" />
      ) : null}
      <WebView
        source={{ uri: url }}
        style={styles.fill}
        onLoadEnd={() => setPainted(true)}
        onError={onFail}
        onHttpError={onFail}
        scrollEnabled={false}
        bounces={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
      <View style={styles.badge}>
        {painted ? (
          <Pill label="Live" tone="live" dot />
        ) : (
          <Pill label={poster ? `Last frame ${agoLabel(poster.at)}` : 'Connecting'} tone="neutral" />
        )}
      </View>
    </View>
  );
}

function FramePlayer({
  cameraId,
  intervalMs,
  probing,
  poster,
  headers,
}: {
  cameraId: string;
  intervalMs: number;
  probing: boolean;
  poster: Poster | null;
  headers: Record<string, string> | null;
}) {
  const { color } = useTheme();
  const { orgId } = useConsole();

  // Double buffer: `front` is what is shown; the next frame loads into `back` and
  // becomes `front` only in its onLoad. The one that just went behind is then given
  // the URL after that, and so on.
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [down, setDown] = useState(false);
  const fails = useRef(0);
  const active = useRef(true);

  /** True while what is on screen is the remembered frame, not a live one. */
  const showingPoster = !front && !!poster;

  // Ask for the next frame on a timer, only while the app is on screen.
  useEffect(() => {
    if (!headers) return;
    setFront(null);
    setBack(null);
    setDown(false);
    fails.current = 0;
    active.current = AppState.currentState === 'active';

    const tick = () => {
      if (!active.current) return;
      setBack(dashboardApi.frameUrl(cameraId));
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (next) => {
      active.current = next === 'active';
      if (active.current) tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [cameraId, intervalMs, headers, orgId]);

  const loaded = (url: string) => {
    fails.current = 0;
    setDown(false);
    setLastAt(Date.now());
    setFront(url);
    // Remembered for the next time this camera is opened, so the tile has
    // something to show before the first poll comes back.
    void writeCache(cacheKey.frame(cameraId), url);
  };
  const failed = () => {
    fails.current += 1;
    if (fails.current >= FAIL_BEFORE_DOWN) setDown(true);
  };

  const status = down
    ? 'No signal'
    : front && !probing
      ? 'Live'
      : showingPoster
        ? `Last frame ${agoLabel(poster.at)}`
        : probing
          ? 'Connecting'
          : 'Loading';
  const tone = down ? 'idle' : front && !probing ? 'live' : 'neutral';

  return (
    <View style={[styles.player, { borderColor: color.border, backgroundColor: color.surfaceSunken }]}>
      {/* The remembered frame holds the tile until a live one decodes over it. */}
      {showingPoster && headers ? (
        <Image source={{ uri: poster.uri, headers }} style={styles.fill} resizeMode="contain" />
      ) : null}
      {front && headers ? (
        <Image source={{ uri: front, headers }} style={styles.fill} resizeMode="contain" />
      ) : null}
      {back && headers && back !== front ? (
        // Loaded off-screen; promoted to the front only once it has decoded.
        <Image
          source={{ uri: back, headers }}
          style={[styles.fill, styles.hidden]}
          onLoad={() => loaded(back)}
          onError={failed}
        />
      ) : null}
      {!front && !showingPoster ? (
        <View style={styles.centre}>
          <Text style={[font.caption, { color: color.textFaint }]}>
            {down
              ? 'This camera has not sent a picture. Still trying.'
              : 'Waiting for the first frame…'}
          </Text>
        </View>
      ) : null}
      <View style={styles.badge}>
        <Pill label={status} tone={tone} dot={tone === 'live'} />
        {lastAt && !down && front ? (
          <Text style={[font.monoSmall, { color: color.white, opacity: 0.8 }]}>
            every {Math.round(intervalMs / 1000)}s
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hidden: { opacity: 0 },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
