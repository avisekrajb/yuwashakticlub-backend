# Shree Yuwa Shakti Club — Backend

Realtime API for the club app.

- **Database:** MongoDB Atlas (`clubdb`)
- **Media:** Cloudinary (photos, videos, audio, story sounds, avatars)
- **Realtime:** Socket.IO (chat, typing, read receipts, reactions, presence, call signalling, live comments)
- **Calls / Live:** LiveKit SFU (audio + video, noise cancellation, speaker, camera/mic toggles)
- **Auth:** JWT (Bearer token)

## Setup

```bash
cd shree-yuwa-shakti-backend
npm install
# .env is already included with the club credentials
npm run dev        # http://localhost:5000
```

Other scripts:

```bash
npm start          # production start
npm run seed       # seed demo members/content
npm run seed -- --force   # wipe content collections and reseed
```

### Demo logins

| Role  | Email          | Password |
|-------|----------------|----------|
| Admin | a@gmail.com    | 123456   |
| User  | sita@gmail.com | 123456   |
| User  | anil@gmail.com | 123456   |

`SEED_ON_START=true` creates the demo content automatically the first time.

## Important behaviour

- Notifications are stored **per user** and Mongo TTL indexes delete them after **30 days** (`NOTIFICATION_DAYS`).
- Stories expire **24 hours** after posting (TTL). Photo/video/sound stories are limited to **15 seconds** of sound/recording.
- Posts support photos and videos (**max 5 minutes, 200 MB**).
- Live videos auto-end after **10 minutes** and when the host disconnects.
- Calls ring for **45 seconds**, then become missed calls and create a notification.
- Account deletion removes posts, stories, comments, messages, calls, notifications and Cloudinary assets.

## API map

| Area | Base |
|------|------|
| Bootstrap | `GET /api/bootstrap` |
| Auth | `/api/auth/register`, `/login`, `/me`, `/password`, `/account` |
| Users | `/api/users`, `/api/users/me`, `/api/users/me/settings` |
| Posts | `/api/posts`, reactions, shares, comments |
| Stories | `/api/stories` |
| Live | `/api/live` (`start`, `token`, `end`, `comment`, `reaction`, `leave`) |
| Chat | `/api/messages/conversations/...` |
| Calls | `/api/calls` (`start`, `token`, `accept`, `join`, `reject`, `end`, `control`, `history`) |
| Notifications | `/api/notifications` |
| Uploads | `/api/uploads/{image,video,audio,avatar,media}` (multipart `file`) |
| Admin collections | `PUT /api/admin/collections/:name` where name is one of `about`, `blogs`, `gallery`, `banners`, `team`, `groups` |

## Socket events

**Client → server:** `chat:join`, `chat:send`, `chat:typing`, `chat:read`, `chat:react`, `chat:edit`, `chat:delete`, `call:start`, `call:accept`, `call:reject`, `call:end`, `call:token`, `call:control`, `live:join`, `live:comment`, `live:reaction`, `live:leave`, `live:end`, `presence:get`, `notifications:read`.

**Server → client:** `chat:message`, `chat:typing`, `chat:read`, `chat:reaction`, `chat:edited`, `chat:deleted`, `conversation:update`, `notification:new`, `presence:list`, `presence:update`, `call:incoming`, `call:ringing`, `call:accepted`, `call:rejected`, `call:ended`, `call:state`, `live:new`, `live:viewers`, `live:comment`, `live:reaction`, `live:ended`, `post:new`, `post:updated`, `post:deleted`, `story:new`, etc.

Connect with:

```js
io(API_URL, { auth: { token } });
```
