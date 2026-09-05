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

Google uses `expo-auth-session`; phone uses Firebase phone auth, whose reCAPTCHA
step is hosted in a WebView (`src/components/RecaptchaModal.tsx`). Fill in
`EXPO_PUBLIC_FIREBASE_*` and the Google client IDs in `.env` to enable both.

With those blank the app runs in **development mode**: sign-in mints an
unverified token that the cloud registry accepts while `CLOUD_ENV` is not
`production`, and any 6-digit code passes. Native Google sign-in additionally
needs `google-services.json` (Android, with a SHA-1 fingerprint) and
`GoogleService-Info.plist` (iOS) in a development build.

## Layout

```
app/                       expo-router routes
  index.tsx                gate: sign-in -> pair agent -> cameras
  sign-in.tsx              Google + phone number
  verify-otp.tsx           6-digit code
  connect-agent.tsx        agent address, QR scan, Test and continue
  cameras/                 registry list and camera detail (live view, test, remove)
  onboarding/              add -> discovery -> credentials -> connecting -> success
src/
  api/                     typed clients for the agent and cloud, error copy
  state/                   auth, agent address, in-flight onboarding draft
  components/              Screen, Button, TextField, Card, Banner, StageList
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
