# Collaboration System Deep Dive

> 🤖 **AI-Generated Docs Alert!** This was written by Claude based on implementing the collaboration system from scratch. It's thorough, but AI can make mistakes. When debugging real-time sync issues, check the actual Socket.IO code in `server/index.js` and `client/src/contexts/SocketContext.jsx`. The logs never lie (well, unless you forgot to add logging).

---

## Overview

HandWaving uses **operation-based synchronization** via Socket.IO. Every change (add stroke, move shape, delete text) is an **operation** that gets executed locally and then broadcast to all collaborators in the same room.

**Why operation-based (not state-based)?**
- State-based: "Here's my entire canvas with 1000 strokes" (100KB+ per change)
- Operation-based: "I added this one stroke" (1KB per change)
- With 5 collaborators drawing simultaneously, operation-based is 100x more efficient

---

## Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Socket.IO Transport (WebSocket)               │
│ - Handles connections, rooms, broadcasts                │
│ - Server: server/index.js                               │
│ - Client: client/src/contexts/SocketContext.jsx         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Operation System                               │
│ - Operation creation, validation, execution              │
│ - Client: client/src/hooks/useOperationManager.js       │
│ - Types: client/src/utils/operations.js                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Canvas State                                    │
│ - allStrokesRef Map (unified storage)                   │
│ - Rendering via useCanvasRenderer                        │
│ - Context: client/src/contexts/CanvasContext.jsx        │
└─────────────────────────────────────────────────────────┘
```

---

## Socket.IO Events

### Client → Server

#### `join:room`
**When:** User opens canvas page
**Payload:**
```javascript
{
  canvasId: "canvas-uuid",
  inviteToken: "token-uuid" | null  // For anonymous users
}
```

**What happens:**
1. Server validates JWT token OR inviteToken
2. Loads canvas from DB (if new room)
3. Converts DB strokes to `STROKE_ADD` operations
4. Adds user to Socket.IO room
5. Responds with `room:joined` event

---

#### `operation`
**When:** User draws, moves, deletes anything
**Payload:**
```javascript
{
  type: "STROKE_ADD" | "STROKE_DELETE" | "STROKE_MOVE" | ...,
  payload: { /* varies by type */ },
  userId: "user-uuid",
  username: "alice",
  timestamp: 1634567890123
}
```

**What happens:**
1. Server receives operation
2. Broadcasts to all users in room (including sender for confirmation)
3. No validation or state tracking on server (clients are source of truth)

---

#### `cursor:move`
**When:** User moves mouse on canvas (throttled to 60fps)
**Payload:**
```javascript
{
  x: 150.5,
  y: 200.3
}
```

**What happens:**
1. Server broadcasts `cursor:update` to all OTHER users in room
2. Includes userId and username for labeling

---

#### `leave:room`
**When:** User navigates away or closes tab
**Payload:** None (automatic Socket.IO disconnect)

**What happens:**
1. Server removes user from room
2. Broadcasts `user:left` to remaining users
3. Cleans up empty rooms

---

### Server → Client

#### `room:joined`
**When:** User successfully joins room
**Payload:**
```javascript
{
  users: [
    { userId: "uuid", username: "alice", socketId: "socket123" }
  ],
  operations: [
    { type: "STROKE_ADD", payload: {...}, userId: "uuid", ... }
  ],
  myUserInfo: {
    userId: "my-uuid",  // For authenticated users: real UUID
                         // For anonymous: localStorage anonymousId
    username: "bob",
    role: "EDITOR"
  }
}
```

**What client does:**
1. Stores `myUserInfo` in SocketContext (for userId, role)
2. Executes all operations to rebuild canvas
3. Adds users to presence list
4. Enables drawing if role is EDITOR/ADMIN/OWNER

**Important:** Anonymous users get canvas data ONLY from this event (they can't call REST API)

---

#### `operation`
**When:** Another user performs an action
**Payload:** Same as client → server operation

**What client does:**
1. Validates operation (has required fields?)
2. Checks if from self (skip if already applied locally)
3. Executes operation via `useOperationManager`
4. Stores inverse in undo stack (for potential undo)
5. Triggers re-render

---

#### `cursor:update`
**When:** Another user moves their cursor
**Payload:**
```javascript
{
  userId: "user-uuid",
  username: "alice",
  x: 150.5,
  y: 200.3
}
```

**What client does:**
1. Updates `userCursorsRef` Map
2. Renders red dot + username label at position
3. Sets 5s timeout to remove stale cursor

---

#### `user:joined`
**When:** New collaborator joins room
**Payload:**
```javascript
{
  userId: "user-uuid",
  username: "alice",
  socketId: "socket123"
}
```

**What client does:**
- Adds user to presence list
- Shows notification (optional, not currently implemented)

---

#### `user:left`
**When:** Collaborator disconnects
**Payload:**
```javascript
{
  userId: "user-uuid"
}
```

**What client does:**
- Removes user from presence list
- Clears their cursor from canvas

---

#### `permission-changed`
**When:** Owner/ADMIN changes your role
**Payload:**
```javascript
{
  userId: "your-user-uuid",
  newRole: "VIEWER"
}
```

**What client does:**
1. Checks if event is for current user
2. **Forces page reload** via `window.location.reload()`

**Why force reload?**
- Role affects 50+ components (toolbars, buttons, permissions)
- Syncing state across all contexts is complex and error-prone
- Refresh guarantees consistency (200ms hiccup vs potential bugs)

---

#### `access-revoked`
**When:** Owner/ADMIN removes you from canvas
**Payload:** None

**What client does:**
1. Shows alert: "Access revoked"
2. Redirects authenticated users to `/gallery`
3. Redirects anonymous users to `/`

---

#### `share-token-rotated`
**When:** Owner rotates share link token
**Payload:** None

**What client does:**
1. Checks if current user is anonymous
2. If yes: Shows alert + redirects to home (old token invalid)
3. If no: Ignores (authenticated users unaffected)

---

#### `collaborators-changed`
**When:** Owner/ADMIN adds/removes collaborator
**Payload:** None (clients should refetch collaborator list)

**What client does:**
- Triggers UserPresence component to reload collaborator list
- Updates UI to show new/removed users

---

#### `room:error`
**When:** Join fails (expired token, wrong permissions, etc.)
**Payload:**
```javascript
{
  message: "Invalid invite token"
}
```

**What client does:**
1. Shows alert with error message
2. Redirects based on auth status:
   - Authenticated: `/gallery`
   - Anonymous: `/`

---

## Operation System

### Operation Structure

Every operation follows this schema:

```javascript
{
  type: string,           // Operation type (see below)
  payload: object,        // Type-specific data
  userId: string,         // Who performed it
  username: string,       // For attribution
  timestamp: number,      // Unix timestamp (ms)
  inverse?: object        // Inverse operation for undo (optional)
}
```

### Operation Types

#### `STROKE_ADD`
**Created when:** User completes a stroke (mouse up after drawing)

**Payload:**
```javascript
{
  strokeId: "stroke-uuid",
  points: [{x: 100, y: 200}, {x: 101, y: 201}, ...],
  config: {
    color: "#f08080",
    lineWidth: 2,
    lineDash: [0],     // [0] = solid, [10,5] = dashed
    lineCap: "round",
    lineJoin: "round"
  }
}
```

**Execution:**
1. Add stroke to `allStrokesRef` Map with strokeId as key
2. Calculate bbox for selection
3. Trigger re-render

**Inverse:** `STROKE_DELETE` with same strokeId

---

#### `STROKE_DELETE`
**Created when:** User deletes selected strokes (Delete key)

**Payload:**
```javascript
{
  strokeId: "stroke-uuid"
}
```

**Execution:**
1. Remove stroke from `allStrokesRef` Map
2. Remove from selection if selected
3. Trigger re-render

**Inverse:** `STROKE_ADD` with original stroke data

---

#### `STROKE_MOVE`
**Created when:** User drags selected strokes

**Payload:**
```javascript
{
  strokeIds: ["stroke-uuid-1", "stroke-uuid-2"],
  offset: { x: 50, y: -30 }
}
```

**Execution:**
1. For each strokeId:
   - If regular stroke: Translate all points by offset
   - If text: Update `{x, y}` coordinates by offset
2. Recalculate bboxes
3. Trigger re-render

**Inverse:** `STROKE_MOVE` with negated offset `{ x: -50, y: 30 }`

---

#### `STROKE_RESIZE`
**Created when:** User drags resize handle

**Payload:**
```javascript
{
  strokeIds: ["stroke-uuid"],
  scaleX: 1.5,
  scaleY: 1.2,
  anchorX: 100,  // Point that stays fixed during resize
  anchorY: 200
}
```

**Execution:**
1. For each strokeId:
   - If regular stroke: Scale points relative to anchor
   - If text: Scale fontSize by `abs((scaleX + scaleY)/2)`, translate position
2. Recalculate bboxes
3. Trigger re-render

**Inverse:** `STROKE_RESIZE` with inverted scales `{ scaleX: 1/1.5, scaleY: 1/1.2 }`

---

#### `STROKE_ROTATE`
**Created when:** User drags green rotation handle

**Payload:**
```javascript
{
  strokeIds: ["stroke-uuid"],
  angle: 0.5,      // Radians (not degrees)
  centerX: 150,    // Rotation pivot
  centerY: 250
}
```

**Execution:**
1. For each strokeId:
   - If regular stroke: Rotate all points around center
   - If text: Rotate position around center (text stays upright)
2. Recalculate bboxes
3. Trigger re-render

**Inverse:** `STROKE_ROTATE` with negated angle `{ angle: -0.5 }`

---

#### `TEXT_ADD`
**Created when:** User submits text via inline editor

**Payload:**
```javascript
{
  textId: "text-uuid",
  text: "Hello\nWorld",
  x: 100,
  y: 200,
  fontSize: 16,
  config: {
    color: "#000000",
    fontFamily: "Comic Sans MS"
  },
  attachedTo: null  // Shape ID if annotating shape
}
```

**Execution:**
1. Calculate multiline bbox (uses canvas.measureText per line)
2. Add to `allStrokesRef` with `type: 'text'`
3. Trigger re-render

**Inverse:** `TEXT_DELETE` with textId

---

#### `TEXT_EDIT`
**Created when:** User edits existing text (double-click)

**Payload:**
```javascript
{
  textId: "text-uuid",
  newText: "Updated text",
  oldText: "Original text"  // For inverse
}
```

**Execution:**
1. Update text content
2. Recalculate bbox (text might be longer/shorter)
3. Trigger re-render

**Inverse:** `TEXT_EDIT` with newText ↔ oldText swapped

---

#### `TEXT_DELETE`
**Created when:** User deletes text object

**Payload:**
```javascript
{
  textId: "text-uuid"
}
```

**Execution:**
1. Remove from `allStrokesRef` Map
2. Remove from selection if selected
3. Trigger re-render

**Inverse:** `TEXT_ADD` with original text data

---

#### `BATCH_ADD_STROKES`
**Created when:** User pastes multiple strokes (Ctrl+V)

**Payload:**
```javascript
{
  strokes: [
    { id: "stroke-uuid-1", points: [...], config: {...} },
    { id: "text-uuid-2", type: "text", text: "...", x: 100, y: 200, ... }
  ]
}
```

**Execution:**
1. Validate each stroke (check required fields)
2. Add all to `allStrokesRef` Map
3. Single re-render for all

**Inverse:** `BATCH_DELETE_STROKES` with same strokeIds

**Why batch?**
- Single undo/redo entry (not 100 separate entries)
- Single broadcast packet (efficient)
- Atomic operation (all-or-nothing)

---

#### `BATCH_DELETE_STROKES`
**Created when:** Inverse of batch add (undo paste)

**Payload:**
```javascript
{
  strokeIds: ["stroke-uuid-1", "text-uuid-2"]
}
```

**Execution:**
1. Remove all from Map
2. Clear from selection
3. Single re-render

**Inverse:** `BATCH_ADD_STROKES` with original stroke data

---

### Conflict Resolution

**Problem:** Two users move the same stroke simultaneously

**Example:**
```
Time: 1000ms - Alice moves stroke 50px right
Time: 1001ms - Bob moves stroke 30px down
```

**Resolution: Last Write Wins (LWW)**

1. Both operations execute locally first (instant feedback)
2. Both broadcast to room
3. Alice receives Bob's operation (timestamp 1001 > 1000) → **replays Bob's move**
4. Bob receives Alice's operation (timestamp 1000 < 1001) → **ignores** (already applied later change)

**Implementation:**
```javascript
// In useOperationManager.js
const executeRemoteOperation = (op) => {
  const existingOp = pendingOperationsRef.current.get(op.payload.strokeId);

  if (existingOp && existingOp.timestamp > op.timestamp) {
    // Ignore older operation
    return;
  }

  // Apply operation
  executeOperation(op);
};
```

**Limitation:** Last write wins can cause "flickering" if operations overlap. Future improvement: Operational Transformation (OT) or CRDTs for true conflict-free sync.

---

## Anonymous User System

### Identity Management

**Problem:** Anonymous users need persistent IDs across page refreshes, but Socket.IO gives new `socket.id` on reconnect.

**Solution: localStorage Persistence**

```javascript
// On first visit, generate and store:
localStorage.setItem('anonymousUserId', crypto.randomUUID());
localStorage.setItem('anonymousUsername', generateAnonymousName());

// generateAnonymousName():
const adjectives = ['Mysterious', 'Silent', 'Swift', ...];
const animals = ['Platypus', 'Falcon', 'Otter', ...];
return `${randomAdjective} ${randomAnimal}`;
```

**Why NOT socket.id:**
- Socket.id changes on reconnect → strokes would be orphaned
- localStorage IDs survive page refresh, browser restart
- Server echoes back anonymousId in `room:joined` event

---

### Share Link Flow

**1. Owner creates share link:**
```
Owner clicks "Share" → Server generates shareToken (UUID) →
Link: http://localhost:5173/canvas/canvas-uuid?inviteToken=token-uuid
```

**2. Anonymous user clicks link:**
```
Browser opens /canvas/:id with ?inviteToken=token-uuid →
Modal: "You've been invited to collaborate. Join as guest?" →
User accepts → Sets guestAcceptedJoin = true
```

**3. Client joins Socket.IO room:**
```javascript
// In SocketContext:
if (isAuthenticated || (inviteToken && guestAcceptedJoin)) {
  socket.emit('join:room', { canvasId, inviteToken });
}
```

**4. Server validates and responds:**
```javascript
// In server/index.js:
const canvas = await prisma.canvas.findUnique({
  where: { id: canvasId }
});

if (inviteToken && canvas.shareToken === inviteToken) {
  // Valid guest
  const role = canvas.shareRole; // EDITOR or VIEWER
  const userId = anonymousId from socket handshake;

  socket.emit('room:joined', {
    operations: [...],
    myUserInfo: { userId, username, role }
  });
}
```

**5. Client rebuilds canvas:**
```javascript
// In CanvasPersistenceContext:
socket.on('room:joined', ({ operations, myUserInfo }) => {
  setMyUserInfo(myUserInfo);  // Store userId + role

  operations.forEach(op => {
    operationManager.execute(op);
  });
});
```

**Why socket-based data loading for anonymous users?**
- Anonymous users can't call `/api/canvases/:id` (requires JWT auth)
- Server loads canvas from DB when creating room
- Converts to operations and sends via `room:joined`
- Same operation execution path as real-time sync

---

### Token Rotation (Kicking Anonymous Users)

**Problem:** Owner rotates share link → old link should stop working immediately

**Solution: Socket.IO Broadcast**

```javascript
// Server (canvasController.js):
await prisma.canvas.update({
  where: { id: canvasId },
  data: { shareToken: crypto.randomUUID() }
});

io.to(canvasId).emit('share-token-rotated');
```

```javascript
// Client (CanvasPersistenceContext):
socket.on('share-token-rotated', () => {
  if (!isAuthenticated) {
    alert('Share link has been rotated. Access revoked.');
    navigate('/');
  }
});
```

**Why broadcast?**
- Anonymous users are already connected via old token
- Checking token on every operation would be slow
- Broadcast instantly kicks all guests, authenticated users unaffected

---

## Real-Time Permission Changes

### The Problem

User role changes from EDITOR → VIEWER:
- Toolbar should disable drawing tools
- Selection handles should disappear
- Keyboard shortcuts (Ctrl+V, Delete) should stop working
- Menu options should change

**Naive solution:** Update `userRole` state, propagate to 50+ components

**Problems:**
- Stale closures (hooks captured old role)
- Missed updates (forgot to check role in one component)
- UI desync (toolbar updated, but keyboard shortcuts didn't)

### The Solution: Force Reload

```javascript
// Server broadcasts:
io.to(canvasId).emit('permission-changed', {
  userId: targetUserId,
  newRole: 'VIEWER'
});

// Client receives:
socket.on('permission-changed', ({ userId, newRole }) => {
  if (userId === currentUser.id) {
    alert(`Your role has been changed to ${newRole}`);
    window.location.reload();  // Nuclear option
  }
});
```

**Why reload wins:**
- Guaranteed consistency (no stale state)
- Simple implementation (5 lines of code)
- Permission changes are RARE (not a performance concern)
- 200ms hiccup vs potential hours debugging state bugs

**Tradeoff:**
- ✅ Zero state management complexity
- ✅ Zero risk of UI desync
- ❌ 200ms page reload (UX hiccup)
- ❌ Loses ongoing stroke (if user was mid-draw)

**Alternative (rejected):** Update `userRole` state + carefully propagate to every consumer. Not worth the complexity.

---

## Debugging Collaboration Issues

### "Remote strokes don't appear"

**Check 1: Is Socket.IO connected?**
```javascript
// In browser console:
window.socket?.connected
// Should return true
```

**Check 2: Are you in the same room?**
```javascript
// In server logs, look for:
logger.info('User joined room', { canvasId, userId });

// Both users should have same canvasId
```

**Check 3: Are operations being broadcast?**
```javascript
// Add to server/index.js:
socket.on('operation', (operation) => {
  console.log('Broadcasting operation:', operation.type, operation.payload);
  io.to(roomId).emit('operation', operation);
});
```

**Check 4: Is operation validation failing?**
```javascript
// In client/src/hooks/useCollaborativeStrokes.js:
console.log('Received operation:', operation);
console.log('Validation passed:', operation.type && operation.payload);
```

**Common causes:**
- Not in same room (check canvasId)
- Operation missing required fields (type, payload, userId)
- Socket listeners not registered (check useEffect deps)

---

### "Canvas wipes after page refresh"

**Symptom:** Load canvas → data appears → refresh → blank canvas

**Cause:** Socket.IO `room:joined` handler clearing strokes before rebuilding

**Fix in CanvasPersistenceContext:**
```javascript
const handleRoomJoined = ({ operations }) => {
  // WRONG:
  clearAllStrokes();  // Wipes DB-loaded data!

  // RIGHT:
  if (allStrokesRef.current.size === 0) {
    // Only rebuild if canvas is empty
    operations.forEach(op => operationManager.execute(op));
  }
};
```

---

### "Undo breaks after remote operation"

**Symptom:** Press Ctrl+Z → nothing happens OR wrong stroke deleted

**Cause:** Undo stack storing references, not copies

**Fix in useOperationManager:**
```javascript
// WRONG:
undoStackRef.current.push(operation.inverse);

// RIGHT:
undoStackRef.current.push(JSON.parse(JSON.stringify(operation.inverse)));
```

---

### "Orange previews never disappear"

**Symptom:** Remote user's ongoing stroke stays on canvas after mouse up

**Cause:** No `stroke:complete` event, or event not handled

**Fix in useCollaborativeStrokes:**
```javascript
socket.on('stroke:complete', ({ strokeId }) => {
  remoteOngoingStrokesRef.current.delete(strokeId);
  requestAnimationFrame(renderCanvas);
});
```

---

### "Guest user can't draw"

**Symptom:** Anonymous user joined via share link, but drawing doesn't work

**Check 1: What's the role?**
```javascript
// In browser console:
window.myUserInfo?.role
// Should be EDITOR, not VIEWER
```

**Check 2: Is share link configured correctly?**
```javascript
// In database:
SELECT "shareRole", "linkSharingEnabled" FROM "Canvas" WHERE id = 'canvas-uuid';
// shareRole should be EDITOR, linkSharingEnabled should be true
```

**Check 3: Is userId persistent?**
```javascript
// In browser console:
localStorage.getItem('anonymousUserId')
// Should be a UUID, not null
```

**Common cause:** Server sent `role: 'VIEWER'` in `room:joined` → client disabled drawing

---

## Performance Considerations

### Operation Batching

**Problem:** Pasting 100 strokes sends 100 separate Socket.IO packets

**Solution:** `BATCH_ADD_STROKES` operation

```javascript
// Instead of:
strokes.forEach(stroke => {
  const op = createOperation('STROKE_ADD', { stroke });
  broadcast(op);
});

// Do this:
const op = createOperation('BATCH_ADD_STROKES', { strokes });
broadcast(op);
```

**Benefits:**
- 1 network packet instead of 100
- 1 undo entry instead of 100
- Single re-render instead of 100

---

### Cursor Throttling

**Problem:** Mouse moves fire at 120-240fps → spams Socket.IO

**Solution: 60fps throttle**

```javascript
let lastCursorSend = 0;

canvas.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastCursorSend < 16.67) return;  // ~60fps

  socket.emit('cursor:move', { x: e.clientX, y: e.clientY });
  lastCursorSend = now;
});
```

---

### Debounced Auto-Save

**Problem:** Every stroke triggers DB write → DB gets hammered

**Solution: 2s debounce**

```javascript
// In useAutoSave.js:
useEffect(() => {
  const timer = setTimeout(() => {
    saveCanvas(getCanvasData());
  }, 2000);

  return () => clearTimeout(timer);
}, [allStrokesRef.current.size]);
```

**Result:** 100 strokes in 10 seconds → 1 DB write (not 100)

---

## Future Improvements

### Operational Transformation (OT)

**Current: Last Write Wins**
- User A moves stroke → User B moves same stroke → B's move wins
- A's move gets overwritten (flickering)

**With OT: Transforms are Composable**
```javascript
// A's move: offset = {x: 50, y: 0}
// B's move: offset = {x: 0, y: 30}
// Result: offset = {x: 50, y: 30}  (both applied)
```

**Complexity:** High (need to implement transform functions for all operation types)

---

### Presence Awareness

**Current:** Red dots with usernames

**Future:**
- User avatars (already have avatarUrl in DB)
- Typing indicators for text editing
- "User is selecting..." indicators
- View-following (see what user is looking at)

---

### Conflict-Free Replicated Data Types (CRDTs)

**Problem:** LWW can lose data (last write "wins", earlier write "loses")

**CRDT Solution:**
- Every stroke has a unique ID + causality metadata
- Operations are commutative (order doesn't matter)
- Guaranteed eventual consistency

**Tradeoff:** More complex implementation, larger operation payloads

---

### Offline Support

**Current:** Must be online to collaborate

**Future:**
- IndexedDB for local canvas cache
- Queue operations while offline
- Sync on reconnect with conflict resolution
- "You have unsaved changes" warning

---

**Questions?** Check the actual Socket.IO code:
- `server/index.js` - Server-side room management + broadcasts
- `client/src/contexts/SocketContext.jsx` - Client-side connection + event handling
- `client/src/hooks/useOperationManager.js` - Operation execution + undo/redo
- `client/src/hooks/useCollaborativeStrokes.js` - Remote stroke handling

The logs are your friend. Add `logger.info()` liberally when debugging.
