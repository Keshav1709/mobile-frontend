# Zero Forg Mobile

Expo (React Native) app for signing in and connecting cameras through the local
[Zero Forg Agent](https://github.com/zeroforgelabs/mobile-backend).

```bash
npm install
cp .env.example .env
npm start
```

## How the app is wired

```
Sign in (Google or SMS)  ->  Cloud registry :8000   profile + tenant
Pair with agent (QR/IP)  ->  Local agent    :8765   discovery, connect, registry
Live view                ->  go2rtc         :1984   stream key, never RTSP
```

The agent runs on a computer on the same Wi-Fi network, so the phone reaches it
at that machine's LAN address — never `127.0.0.1`. Open
`http://<agent-host>:8765/pair` on that computer to get a scannable code.

## Sign-in

Email + password against the same Firebase project as the dashboard. There is
no sign-up in the app: accounts are created by an administrator on the
dashboard, and the app only signs them in. Google appears only when a native
OAuth client id is configured (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`).

With the Firebase keys blank the app runs in **development mode**: sign-in
mints an unverified token that the registry accepts only while `CLOUD_ENV` is
not `production`. `EXPO_PUBLIC_*` values are inlined at build time: after
changing `.env`, restart with `npx expo start -c`.

## ZeroForg Box

Settings → ZeroForg Box (or the menu) binds a box to the workspace by the
6-character code it shows on `http://<box>:8765/pair`, then reports whether it
is online, on the factory network and talking to the cloud, from the
registry's `GET /api/devices`. No first-run wizard: the app opens straight to
Home after sign-in.

## Areas

`app/zones/[cameraId].tsx` is the dashboard's `ZoneEditorPanel` + `ZoneCanvas`
for touch: choose what the area is, tap points around it on a still frame from
the relay (`api/frame.jpeg`, or a grid when there is no stream), tap the first
point again to close, save. Polygons are normalised and stored on the camera in
the registry (`PUT /api/cameras/{id}/zones`), which is what the box polls.
Reachable from the setup step, **Profile → Camera areas**, and **Edit areas**
in a camera's settings panel on Live.

Every page has a back control (`goBack(fallback)` in `src/lib/helpers.ts`):
back to the previous page, or to the page that logically precedes it when the
page was reached by a redirect.

## Layout

```
app/                       expo-router routes
  index.tsx                gate: sign-in -> app
  sign-in.tsx              email + password (Google when configured)
  create-profile.tsx       edit profile
  box.tsx                  bind a ZeroForg Box, connection checks
  settings.tsx             appearance, workspace, account, box
  zones/                   camera list -> area editor
  onboarding/              add -> discovery -> credentials -> connecting -> success
  (tabs)/                  home, live, add, profile, ai, alerts
src/
  api/                     typed clients for the agent and cloud, error copy
  state/                   auth (profile + setup status), agent address, camera draft
  components/              Screen, Button, TextField, Card, Banner, StageList, ZoneCanvas, BottomSheet, ListRow
  lib/zones.ts             ZonePolygon types, area labels, geometry (ported from the dashboard)
  theme.ts                 design tokens
```

## Security

- Camera passwords live in a ref for the length of the onboarding flow and are
  cleared once the connect request is built. They never reach storage, a URL, a
  log, or the cloud.
- Only the Firebase ID token and the agent address are persisted, both in
  `expo-secure-store`.
- Live view loads a go2rtc stream key. Authenticated RTSP URLs are never
  requested or displayed.
