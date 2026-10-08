# Listenly Web

Web client (Vue 3) for **Listenly** — a *listen together* platform where a group
joins a room and listens to YouTube audio in real-time sync. This app integrates
with the Listenly backend microservices through the single HTTP/WebSocket API
Gateway (`/api/v1`).

## Stack

- **Vue 3** + `<script setup>` + **TypeScript**
- **Vite** build tooling
- **Pinia** for state
- **Vue Router** for routing (with auth guards)
- **Axios** HTTP client with Bearer auth + rotating-refresh interceptor
- Native **WebSocket** for realtime, with auto-reconnect + backoff
- **Tailwind CSS v4** + shadcn-vue (reka-ui) components

## Getting started

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your gateway
npm run dev
```

### Environment

| Var | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | API Gateway base URL (app appends `/api/v1`) | `http://localhost:8080` |
| `VITE_WS_BASE_URL` | Optional explicit WS base; derived from API base otherwise | — |

## Backend integration

Everything talks to the gateway only (services behind it use gRPC and are not
public). The envelope for every response is `{ success, message, data?, errors? }`.

### Project layout

```
src/
  config/env.ts         # base URLs (HTTP + WS), per-environment
  types/api.ts          # DTOs from the backend contract (PRD §5, §9)
  lib/
    http.ts             # Axios instance, Bearer + refresh-on-401, error mapping (§6)
    realtime.ts         # per-room WebSocket client, reconnect w/ backoff (§5.4, §8)
    tokenStorage.ts     # access/refresh token + user persistence
    format.ts           # duration / status formatting
  services/             # one module per backend domain
    authService.ts      # /auth/*          (§5.1)
    roomService.ts      # /rooms/*         (§5.2)
    musicService.ts     # /music/*         (§5.3)
  stores/               # Pinia stores
    auth.ts             # session, login/register/logout(-all), /auth/me
    rooms.ts            # discovery: public + mine, create, join (code/token)
    room.ts             # active room: queue, playback, realtime, drift correction
  router/index.ts       # routes + auth/guest guards
  views/                # Login, Register, Rooms, CreateRoom, Room, Join, NotFound
  components/           # layout + room (player, queue, search, invite) + common
```

### Covered backend surface (all gateway endpoints)

- **Auth** (§5.1): register, login, refresh (rotating, auto on 401), logout,
  logout-all, `/auth/me`. Session persists across reloads.
- **Room** (§5.2): create (public/private), list public, list mine (paginated),
  get, join public, join by invite code/token, leave (hidden for host),
  update/get playback (host-only).
- **Music & queue** (§5.3): YouTube search, catalog search, get track, get
  single-use stream URL, request track, list queue, advance (host), mark played,
  remove item (requester or host).
- **Realtime** (§5.4): one WebSocket per room (`?token=`), handling
  `connected`, `playback_updated`, `queue_updated`; resync on reconnect.

### Playback sync

The `<audio>` element follows the authoritative playback state. On a remote
`playback_updated` (or a post-reconnect `GET playback`), the player corrects
drift when the local position is off by **> 1.5s** (PRD §8). Stream URLs are
single-use: fetched right before play, never cached, and re-requested on error.
The host auto-advances the queue when a track ends.

### Authorization reflected in UI (PRD §6)

- Only the **host** can change playback / advance the queue (controls hidden
  for non-hosts; `403`-aware).
- Removing a queue item is allowed for the **requester** or the **host**.
- The **host cannot leave** a room — the leave button is hidden for the host.

## Scripts

```bash
npm run dev      # dev server
npm run build    # type-check (vue-tsc) + production build
npm run preview  # preview the production build
```
