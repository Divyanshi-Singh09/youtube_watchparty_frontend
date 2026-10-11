# 🎬 Real-Time YouTube Watch Party

A production-grade, synchronized YouTube watch party web application built with **React**, **Node.js/Express**, **Socket.IO**, and **MongoDB Atlas**.

Enjoy synchronized YouTube video streaming with friends, complete with real-time text chat, emoji reactions, role-based controls, and a participant approval queue.

---

## 📑 Table of Contents
1. [Key Highlights](#-key-highlights)
2. [User Guide: How to Use WatchParty](#-user-guide-how-to-use-watchparty)
3. [Technology Stack](#-technology-stack)
4. [Architecture & Mathematical Sync Model](#-architecture--mathematical-sync-model)
5. [Repository Structure](#-repository-structure)
6. [Getting Started (Local Setup)](#-getting-started-local-setup)
7. [Automated Testing Suite (85 / 85 Passing)](#-automated-testing-suite-85--85-passing)
8. [WebSocket Events Reference](#-websocket-events-reference)
9. [Production Deployment](#-production-deployment)
10. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🚀 Key Highlights

- **Sub-100ms Mathematical Anchor Model**:
  Instead of flooding the network with 1-second ticks, server and clients synchronize via a deterministic anchor equation:
  $$\text{liveTime}(t) = \text{currentTime} + \frac{t - \text{updatedAt}}{1000} \quad (\text{when playing})$$
- **Live In-Room Chat & Reactions**:
  Instant messaging with role badges (Host, Moderator, Participant), timestamps, auto-scroll, unread indicators, and a quick-tap emoji reaction bar (`👍`, `❤️`, `🔥`, `😂`, `🍿`, `👏`, `🎉`, `😮`).
- **Strict Role-Based Access Control (RBAC)**:
  - **Host**: Room creator. Can manage roles, kick members, control playback, resolve requests, and chat.
  - **Moderator**: Appointed by the host. Can play, pause, seek, load videos, resolve participant requests, and chat.
  - **Participant**: View-only playback synchronized with staff. Can chat, react, and submit playback change requests to staff.
- **Participant Change Request & Approval Flow (FR-11)**:
  Participants can submit change requests (`request_change`). Requests are routed strictly to the staff channel (`room:<id>:staff`), where hosts and moderators can approve or reject them with real-time feedback.
- **Hybrid Real-Time In-Memory Engine + MongoDB Atlas Persistence (BON-3)**:
  High-performance in-memory room management (`RoomManager`) coupled with asynchronous MongoDB Atlas syncing. Archived rooms and chat histories are restored upon rejoin.
- **Graceful Reconnection Window**:
  Disconnected sockets receive a 30-second grace window to reconnect using their secure `sessionToken` without losing host status or resetting room playback.
- **YouTube IFrame API Integration**:
  Embedded player with `controls: 0` to prevent unsynchronized local scrubbing, smart autoplay-block detection with a click-to-unmute modal, and a $\pm1.5\text{s}$ drift correction threshold.

---

## 📖 User Guide: How to Use WatchParty

### 1. Creating a Watch Party (Host)
1. Navigate to the Home Page (`http://localhost:5173`).
2. Enter your display name under **Create a Party**.
3. *(Optional)* Paste a YouTube URL or 11-character video ID to start with an initial video.
4. Click **Create Watch Party**.
5. You will enter the room as the **Host** with an auto-generated 8-character Room Code (e.g., `A9QDXT7M`).

### 2. Inviting Friends
- Click the **🔗 Share Link** button in the top navigation bar to copy the direct room link to your clipboard.
- Alternatively, share the 8-character **Room Code**. Friends can enter this code under **Join Existing Party** on the home page.

### 3. Playing and Changing Videos
- **Host / Moderator**:
  - Paste any YouTube link (standard, shortened `youtu.be`, mobile, or video ID) into the top input bar and click **Load Video**.
  - Use the custom playback bar underneath the video to **Play**, **Pause**, or **Seek** through the timeline.
- **Participant**:
  - Participants see a **Request Video** / **Request Change** form. Submitting a request sends it directly to the Host/Moderators' approval queue.

### 4. Live Chatting & Emoji Reactions
- Click the **💬 Chat** tab in the right sidebar.
- Type a message in the input box (up to 500 characters) and press **Enter** or click **➤**.
- Click any quick emoji (`👍`, `❤️`, `🔥`, `😂`, `🍿`, etc.) to quickly add emojis to your message.
- If you switch to the **👥 People** tab, an unread message badge (e.g., `2`) will appear on the Chat tab whenever new messages arrive.

### 5. Managing Room Members & Moderation (Host Only)
- Click the **👥 People** tab in the sidebar.
- Click the `⋮` menu next to any participant's name to:
  - **Promote to Moderator** / **Demote to Participant**.
  - **Remove from Room** (Kick).

### 6. Reviewing Participant Change Requests (Staff)
- When a participant requests a video or playback change, an **Approval Queue** banner appears above the sidebar.
- Host or Moderators can click **✓ Approve** (which immediately updates playback for the whole room) or **✕ Reject**.

---

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| **Frontend Framework** | React 18, Vite |
| **Routing & Navigation** | React Router DOM v7 |
| **Styling** | Vanilla CSS (Tailored dark mode design system, Glassmorphism, Micro-animations) |
| **Media Player** | YouTube IFrame Player API |
| **Backend Runtime** | Node.js (ES Modules), Express 5 |
| **Real-Time WebSockets** | Socket.IO v4 (WebSocket transport) |
| **Database & ODM** | MongoDB Atlas, Mongoose v8 |
| **Schema Validation** | Zod v4 |
| **Security & Utilities** | Helmet, CORS, Express Rate Limit, Crypto (SHA-256 tokens) |
| **Testing** | Vitest, Supertest, Socket.IO Client (85 passing tests) |

---

## 🧠 Architecture & Mathematical Sync Model

```
                    ┌─────────────────────────┐
                    │      Client Browser     │
                    │   React + YouTube Player│
                    └────────────┬────────────┘
                                 │ WebSocket (Socket.IO)
                                 ▼
                    ┌─────────────────────────┐
                    │      Express Server     │
                    │    Socket.IO Handlers   │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
      ┌────────────────────┐          ┌────────────────────┐
      │ In-Memory Engine   │          │  MongoDB Atlas     │
      │   RoomManager      │ ◄──────► │ Room Persistence   │
      │ Sub-ms Live State  │          │ Long-term Storage  │
      └────────────────────┘          └────────────────────┘
```

### Anchor-Based Synchronization
Rather than streaming continuous timestamps, the server stores a playback anchor:
```json
{
  "videoId": "dQw4w9WgXcQ",
  "playState": "playing",
  "currentTime": 45.2,
  "updatedAt": 1718000000000
}
```
Clients calculate elapsed playback mathematically:
$$\text{calculatedTime} = \text{anchorTime} + \frac{\text{Date.now()} - \text{updatedAt}}{1000}$$
- If local player drift exceeds $\pm1.5\text{s}$, the client automatically seeks to the authoritative time.
- If drift is within tolerance, local playback continues smoothly without stutter.

---

## 📁 Repository Structure

```text
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variables & MongoDB Atlas connection
│   │   ├── domain/          # Pure Domain Models (Room, Participant, PlaybackState, RBAC)
│   │   ├── http/            # Express controllers, routes, healthcheck, rate limiters
│   │   ├── models/          # Mongoose models (RoomModel with Messages sub-schema)
│   │   ├── schemas/         # Zod schemas (REST requests & Socket.IO events)
│   │   ├── services/        # roomPersistence MongoDB sync service
│   │   ├── sockets/         # Socket.IO handlers (room, playback, role, approval, chat)
│   │   └── utils/           # Room code generator, session token hashing
│   └── tests/               # 85 automated Vitest integration tests
├── frontend/
│   ├── src/
│   │   ├── components/      # VideoPlayer, Controls, ChatBox, ParticipantList, ApprovalQueue, Toast
│   │   ├── hooks/           # useRoom (WebSocket lifecycle & chat), useYouTubePlayer
│   │   ├── pages/           # HomePage, RoomPage
│   │   ├── services/        # REST api client, Socket.IO client singleton
│   │   └── utils/           # YouTube URL parser, session token storage
│   └── index.html
├── docs/                    # Architecture documents & technical specs
├── CHANGES.md               # Detailed log of all files changed
└── README.md                # Project documentation
```

---

## 🏃 Getting Started (Local Setup)

### Prerequisites
- **Node.js**: v20 or higher
- **npm**: v9 or higher
- **MongoDB Atlas** account (or local MongoDB URI)

---

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd assigment
```

---

### Step 2: Configure and Start Backend

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   npm install
   ```
2. Verify or create `backend/.env`:
   ```env
   PORT=4000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173
   MAX_PARTICIPANTS_PER_ROOM=50
   EMPTY_ROOM_TTL_MINUTES=30
   DISCONNECT_GRACE_SECONDS=30
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.dyhocgi.mongodb.net/watchparty?retryWrites=true&w=majority
   ```
3. Start the backend server:
   ```bash
   npm run dev
   ```
   *The backend will start at `http://localhost:4000`.*

---

### Step 3: Configure and Start Frontend

1. In a new terminal, navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   npm install
   ```
2. Verify or create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:4000/api
   VITE_SOCKET_URL=http://localhost:4000
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The frontend will start at `http://localhost:5173`.*

4. Open your browser at [http://localhost:5173](http://localhost:5173).

---

## 🧪 Automated Testing Suite (85 / 85 Passing)

The project includes an end-to-end integration and unit test suite powered by **Vitest** and **Supertest**.

Run tests from the `backend/` directory:
```bash
cd backend
npm test
```

### Verified Test Matrix:
| Test File | Description | Status |
|---|---|---|
| `health.test.js` | Express healthcheck & security headers | ✅ Passed |
| `routes/rooms.test.js` | REST room creation, codes, metadata, rate limits | ✅ Passed |
| `domain/permissionService.test.js` | RBAC matrix permissions for Host, Moderator, Participant | ✅ Passed |
| `domain/playbackState.test.js` | Mathematical anchor time calculations | ✅ Passed |
| `domain/persistence.test.js` | MongoDB Atlas room saving and restoration | ✅ Passed |
| `sockets/room.test.js` | Room joining, authentication, DTOs, departure | ✅ Passed |
| `sockets/playback.test.js` | Play, pause, seek, change video, state broadcasts | ✅ Passed |
| `sockets/role.test.js` | Role promotion/demotion, kick participant | ✅ Passed |
| `sockets/approval.test.js` | Participant request flow, staff approval & rejection | ✅ Passed |
| `sockets/chat.test.js` | Real-time chat broadcasting, payload validation, rate limiting, message history | ✅ Passed |
| `utils/youtube.test.js` | YouTube URL parser & ID extractor edge cases | ✅ Passed |

---

## 🔌 WebSocket Events Reference

| Event Name | Direction | Payload | Required Role | Description |
|---|---|---|---|---|
| `join_room` | C → S | `{ roomId, username, sessionToken? }` | Anyone | Join room; restores host or creates participant |
| `leave_room` | C → S | `{ roomId }` | Joined user | Explicit room departure |
| `sync_state` | S → C | `{ playState, currentTime, videoId, updatedAt }` | – | Authoritative playback state broadcast |
| `play` | C → S | `{ currentTime? }` | Host / Moderator | Resume playback across room |
| `pause` | C → S | `{ currentTime? }` | Host / Moderator | Pause playback across room |
| `seek` | C → S | `{ time }` | Host / Moderator | Seek to timestamp |
| `change_video` | C → S | `{ videoId }` | Host / Moderator | Load new YouTube video |
| `chat_message` | C → S | `{ message }` | Anyone | Send message (1–500 chars, rate-limited) |
| `chat_message` | S → Room | `{ messageId, userId, username, role, message, sentAt }` | – | Broadcast chat message to room |
| `request_change`| C → S | `{ action: { type, ... } }` | Participant | Submit playback change for approval |
| `resolve_change`| C → S | `{ requestId, decision }` | Host / Moderator | Approve (`decision: 'approve'`) or reject |
| `assign_role` | C → S | `{ userId, role }` | Host only | Change user role (`moderator` / `participant`) |
| `remove_participant`| C → S| `{ userId }` | Host only | Kick user from room |

---

## 🌐 Production Deployment

### Backend (Render, Railway, or AWS)
1. Set the Root Directory to `backend/`.
2. Build Command: `npm install`.
3. Start Command: `npm start`.
4. Add Environment Variables:
   - `PORT=10000`
   - `NODE_ENV=production`
   - `CLIENT_URL=https://your-frontend-domain.com`
   - `MONGODB_URI=your-mongodb-atlas-connection-string`

### Frontend (Vercel, Netlify, or Cloudflare Pages)
1. Set the Root Directory to `frontend/`.
2. Build Command: `npm run build`.
3. Output Directory: `dist`.
4. Add Environment Variables:
   - `VITE_API_URL=https://your-backend-domain.com/api`
   - `VITE_SOCKET_URL=https://your-backend-domain.com`

---

## ❓ Troubleshooting & FAQ

### 1. "Video paused / Click to play" overlay appears
- **Cause**: Web browsers (Chrome, Edge, Safari) block autoplay with unmuted audio unless the user has interacted with the page.
- **Solution**: Click the green **Click to Start Playing** button on the overlay to resume playback in sync.

### 2. "Rate limit exceeded" in chat
- **Cause**: Chat messages are rate-limited to 5 messages per 10 seconds to prevent spam.
- **Solution**: Wait a few seconds before sending additional messages.

### 3. Participant controls are disabled
- **Cause**: By design, only the **Host** and **Moderators** can directly change video playback.
- **Solution**: Participants can submit requests using the **Request Change** form, or the Host can promote the participant to Moderator via the People menu (`⋮`).

### 4. Reconnecting after page refresh
- Session credentials (`userId` and `sessionToken`) are saved in browser `sessionStorage`. Refreshing the page automatically restores your identity and role.

---

## 📄 License
ISC License. Built for seamless collaborative media streaming.
