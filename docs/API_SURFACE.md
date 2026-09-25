# What the app talks to

Every network call the phone makes, where it goes, and what the person sees as a result.

Four services answer this app. Three are ours; one is Google's.

| Service | Repo | Base URL | Endpoints used |
|---|---|---|---|
| **Dashboard** | `zeroforge-backend` | `https://dashboard.zeroforg.com/api/v1` | 28 |
| **Registry** | `mobile-backend` | `EXPO_PUBLIC_CLOUD_URL` (`https://app.zeroforg.com`) | 7 |
| **Agent** | `mobile-backend/agent` | `http://<box-on-your-lan>:8765/api` | 7 |
| **go2rtc** | third party, runs on the box | discovered from the agent | 4 |
| | | **Total** | **46** |

Firebase Authentication is also called, by its SDK rather than by us, so it is not counted here.

**We have not added a single endpoint to any backend.** Everything below already existed. Our work has been consuming the right ones, which is not the same thing — see [What changed recently](#what-changed-recently).

---

## 1. Dashboard — `zeroforge-backend`

The main one. Almost everything a person reads comes from here, and it is the only
service that works from any network, because it is on the public internet.

Every call carries `Authorization: Bearer <firebase id token>` and, when a centre is
chosen, `X-Org-ID: <org uuid>`.

### Identity and permissions

| Method | Path | Called by | What it gives |
|---|---|---|---|
| GET | `/realm` | `consoleApi.realm` | The org tree this account can see |
| GET | `/console/manifest` | `consoleApi.manifest` | Org, sites, role, permissions, live settings. Cached 60s server-side |

`manifest` is the important one. Almost every screen checks it before rendering, because
it decides what the person is allowed to see. `miraCapabilities` does not call anything
of its own; it reads `mira.use` out of the manifest.

### Live video

| Method | Path | Called by | What it gives |
|---|---|---|---|
| GET | `/vms/cameras` | `cloudApi.listCameras` | Every camera in the workspace |
| GET | `/vms/cameras/config/{id}` | `cloudApi.getCamera`, `getCameraZones` | One camera, with its drawn zones |
| PUT | `/vms/cameras/config/{id}` | `cloudApi.updateCameraZones` | Saves zones, bumps `config_version` |
| GET | `/vms/cameras/{id}/stream` | `dashboardApi.frameUrl` | The newest annotated JPEG, pushed by the edge |
| GET | `/vms/cameras/{id}/live-url` | `dashboardApi.liveUrl` | A signed MJPEG URL, where the site runs go2rtc |
| GET | `/console/live/cameras` | `dashboardApi.liveCameras` | Per-camera health, from presence |

### Alerts

| Method | Path | Called by | What it gives |
|---|---|---|---|
| GET | `/alerts` | `dashboardApi.alerts` | Paged alerts, filtered by status and site |
| POST | `/alerts/{id}/acknowledge` | `dashboardApi.acknowledgeAlert` | Marks one as seen |
| GET | `/alert-rules` | `dashboardApi.settings` | Which alert types fire, and how |

### People and faces

| Method | Path | Called by |
|---|---|---|
| GET | `/console/people` | `dashboardApi.people` |
| GET | `/face-gallery/persons` | `dashboardApi.people` |
| GET | `/face-gallery/unknown` | `dashboardApi.unknownFaces` |
| GET | `/face-clusters` | `dashboardApi.faceClusters` |

### Attendance

| Method | Path | Called by |
|---|---|---|
| GET | `/attendance/overview?date=` | `dashboardApi.attendanceOverview` |
| GET | `/attendance/stats?days=` | `dashboardApi.attendanceStats` |
| GET | `/attendance/ranking?days=` | `dashboardApi.attendanceRanking` |

### Reports and recordings

| Method | Path | Called by |
|---|---|---|
| GET | `/reports/templates` | `dashboardApi.reportTemplates` |
| GET | `/reports/runs?limit=` | `dashboardApi.reportRuns` |
| GET | `/reports/{templateId}/preview?date=` | `dashboardApi.reportPreview` |
| GET | `/reports/runs/{runId}/html` | `dashboardApi.reportRun` |
| GET | `/clips/?limit=` | `dashboardApi.recordings` |

### Mira

| Method | Path | Called by |
|---|---|---|
| GET | `/agents/sessions?limit=` | `dashboardApi.miraSessions` |
| GET | `/agents/sessions/{id}` | `dashboardApi.miraSession` |

### Workspace settings

| Method | Path | Called by |
|---|---|---|
| GET | `/org-config/` | `dashboardApi.settings` |
| GET | `/realm/members` | `dashboardApi.settings` |
| GET | `/realm/sites` | `dashboardApi.settings` |

---

## 2. Registry — `mobile-backend`

A thin service for the few things the dashboard has no column for. It reads the
dashboard's own Postgres, so it invents nothing.

**It is not deployed yet.** `EXPO_PUBLIC_CLOUD_URL` points at `https://app.zeroforg.com`,
which currently answers nothing. The app is built to survive that: sign-in falls back to
the dashboard manifest and sets `registryOffline`, and edit controls hide themselves.
Everything in the table above keeps working. See [When the registry is down](#when-the-registry-is-down).

| Method | Path | Called by | What it does |
|---|---|---|---|
| GET | `/api/auth/config` | `cloudApi.config` | Whether the registry is read-only |
| POST | `/api/auth/session` | `cloudApi.createSession` | Verifies the token, upserts the user |
| GET | `/api/auth/me` | `cloudApi.me` | The profile, including app-only fields |
| PATCH | `/api/auth/me` | `cloudApi.saveProfile` | Saves app-only profile fields |
| GET | `/api/devices` | `cloudApi.listDevices` | Boxes on this workspace, with their checks |
| POST | `/internal/cameras/sync` | `cloudApi.registerCamera` | Files a newly connected camera |
| DELETE | `/internal/cameras/{id}` | `cloudApi.deleteCamera` | Removes one |

---

## 3. Agent — on the box, on your network

Only reachable when the phone is on the same network as a ZeroForg box. The app finds it
by trying the last known host, then sweeping the local `/24` on port 8765
(`src/agent/locate.ts`). No agent means these features hide rather than fail.

The agent mounts everything under `/api`, so the client prepends it
(`src/agent/client.ts`). A bare `/pair` returns an HTML pairing page, not JSON.

| Method | Path | Called by | What it does |
|---|---|---|---|
| GET | `/api/pair` | `agentApi.info` | Who this box is, and where its go2rtc is |
| GET | `/api/cameras/discover` | `agentApi.startScan` | Starts an ONVIF scan, returns a `scan_id` |
| GET | `/api/cameras/discover/{scanId}` | `agentApi.scan` | Polls that scan |
| POST | `/api/cameras/connect` | `agentApi.startConnect` | Authenticates a camera, returns a `job_id` |
| GET | `/api/cameras/connect/{jobId}` | `agentApi.connectJob` | Polls that job |
| POST | `/api/cameras/{id}/pan` | `agentApi.pan` | Pan, tilt, zoom |
| DELETE | `/api/cameras/{id}` | `agentApi.remove` | Forgets the camera and its stored password |

Camera passwords go to the agent and stay there, encrypted. They never reach the cloud.

---

## 4. go2rtc — the video relay on the box

iOS cannot play RTSP, so a camera's stream is registered with go2rtc, which republishes
it as WebRTC/MSE. Its address is **not** configured; it is derived from the agent
(`src/onvif/relay.ts`) — see [Finding go2rtc](#finding-go2rtc).

| Method | Path | Called by | What it does |
|---|---|---|---|
| PUT | `/api/streams?name=&src=` | `publishStream` | Registers an RTSP stream |
| DELETE | `/api/streams?name=` | `unpublishStream` | Removes it |
| GET | `/stream.html?src=` | `livePlayerUrl` | The player page, loaded in a WebView |
| GET | `/api/frame.jpeg?src=` | `frameUrl` | One still, for drawing zones on |

---

## The flows that matter

### Signing in

```
person types email and password
  -> Firebase SDK           returns an ID token
  -> POST /api/auth/session (registry)   verify, upsert the user
  -> GET  /console/manifest (dashboard)  org, role, permissions
  -> app decides which tabs to show
```

If the registry cannot be reached, step two is skipped, the profile is assembled from the
manifest alone, and `registryOffline` is set. **Sign-in still works.** Only the app-only
profile fields go missing.

### Watching a camera

```
open Live
  -> GET /vms/cameras                  the list
  -> GET /console/live/cameras         which are actually sending  (every 20s)
  -> manifest says go2rtc?
       yes -> GET /vms/cameras/{id}/live-url   signed MJPEG, played in a WebView
       no  -> GET /vms/cameras/{id}/stream     newest JPEG, polled every ~2s
```

Both paths go through the dashboard, so live video works from any network. The LAN path
through go2rtc is only used for cameras the box is relaying directly.

### Adding a camera

Needs an agent on the network. This is the one flow that is mostly local.

```
Settings, Add a camera
  -> GET  /api/cameras/discover            start the ONVIF scan
  -> GET  /api/cameras/discover/{scan_id}  poll until it finishes
  person picks a camera and types its username and password
  -> POST /api/cameras/connect             agent authenticates, reads the RTSP profile
  -> GET  /api/cameras/connect/{job_id}    poll until connected
  -> PUT  {go2rtc}/api/streams             register the stream for playback
  -> POST /internal/cameras/sync           file it against the workspace
```

### Alerts

```
open Alerts
  -> GET  /alerts?status=active
  person taps Acknowledge
  -> POST /alerts/{id}/acknowledge
  -> refetch
```

The live socket (`vms/ws/live`) also pushes `alert` and `event` messages, so the list
refreshes without a pull-to-refresh while the app is open.

---

## Things worth knowing

### Finding go2rtc

The agent reports `go2rtc_url` from its own config, which defaults to
`http://127.0.0.1:1984` — its own loopback, meaningless to a phone. So only the **scheme
and port** of that are used; the **host** is the address the phone actually reached the
agent on. One APK then works on every customer's network.

### The frame endpoint does not fail loudly

`GET /vms/cameras/{id}/stream` answers an unauthenticated request with **200 and an SVG
placeholder**, not a 401. A client that loses its auth header sees a success it cannot
render, and shows an empty tile with nothing logged. Both this app and the web console
work around it — the app puts the token in the URL, the web sniffs the content-type.

### Camera status has two meanings

`status` on `/vms/cameras` comes from a column written once at onboarding and never
updated. It says `online` for cameras that have sent nothing for hours.

Real health is on `/console/live/cameras`, which answers from presence: a camera is online
if a frame or detection arrived in the last 60 seconds. `src/lib/cameraHealth.ts` turns
that into green, amber and red.

### 403 means three different things

The dashboard returns 403 for "your role does not include this", for "not enabled for this
organisation", and for `"User is not provisioned"` — which is transient, and answers 200 a
second later. `src/api/client.ts` tells them apart by reading the message, and retries the
third once. The proper fix is server-side: the last one should be a 503.

### When the registry is down

| Keeps working | Stops |
|---|---|
| Sign-in | Editing the profile's app-only fields |
| Live video, alerts, attendance, reports, people, Mira | Filing a newly added camera |
| Camera list and zones | Seeing which box is on the workspace |

The app also goes read-only, because `readOnly` defaults to true until the registry says
otherwise. Showing an edit control that then fails is worse than hiding one that works.

---

## What changed recently

**No backend endpoint was added.** What changed is which ones the app calls.

| Change | Endpoint | Why |
|---|---|---|
| Newly consumed | `GET /console/live/cameras` | Real camera health. Already existed and was used by the web console; the app was still trusting the stale `status` column |
| Changed | `GET /vms/cameras/{id}/stream` | The token now rides on the URL as well as the header, because a native image loader cannot be relied on to send headers |
| Changed | go2rtc base URL | Derived from the agent instead of `EXPO_PUBLIC_GO2RTC_URL`, so one APK works everywhere |
| **Removed** | `POST /api/devices/claim` | The app no longer binds boxes. A box is claimed on the dashboard by whoever installs it. The endpoint still exists server-side; nothing here calls it |

### Still open, server-side

- `"User is not provisioned"` fails roughly 1 request in 5 with a valid token, and returns
  403 where 503 belongs. The app retries; the web console does not.
- `/vms/cameras/{id}/stream` returning 200 for unauthenticated requests, as above.
- The registry has no public deployment. `https://app.zeroforg.com` is the agreed address
  and nothing answers there yet.
