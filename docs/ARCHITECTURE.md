# Architecture Documentation

> 👋 **Heads up!** This documentation was lovingly crafted by Claude (your friendly AI assistant) based on countless hours of pair programming sessions aim to provide the minimal documentation. It's comprehensive, but like all AI-generated content, proceed with healthy skepticism. Cross-reference with the actual code when in doubt - the code is always the source of truth!

---

## Overview

React-based collaborative whiteboard that transforms hand-drawn gestures into clean geometric shapes. Built with **Vite + React**, **Tailwind CSS**, **Socket.IO**, **PostgreSQL + Prisma**.

**Core Philosophy:** Operation-based architecture where every change is an operation (add/delete/move/resize/rotate) with inverse operations for undo/redo. Everything broadcasts through Socket.IO for real-time collaboration.

---

## Tech Stack

### Frontend

- **React 18** - UI framework
- **Vite** - Build tool (fast HMR, ~200ms rebuilds)
- **Tailwind CSS v4** - Utility-first styling with Comic Sans MS font, coral/peach palette
- **Socket.IO Client** - WebSocket communication
- **Lucide React** - Icon library
- **React Router** - Client-side routing

### Backend

- **Node.js + Express** - HTTP server
- **Socket.IO** - Real-time WebSocket server
- **PostgreSQL** - Relational database
- **Prisma 6.17.0** - ORM with schema migrations
- **JWT (jsonwebtoken)** - Authentication tokens (httpOnly cookies)
- **bcrypt** - Password hashing
- **Winston** - Structured logging with PII sanitization
- **express-rate-limit** - DoS protection

### Development

- **ESLint** - Code linting
- **Git** - Version control
- **npm workspaces** - Monorepo management (client + server)

---

## System Architecture

### Data Flow

```
User Action → Operation Created → Execute Locally → Broadcast to Room →
Remote Users Receive → Validate & Execute → Inverse Stored in Undo Stack →
Auto-save to DB (debounced 2s)
```

### Key Architectural Decisions

**1. Operation-Based Sync (Not State-Based)**

- Every action is an operation with a type, payload, userId, timestamp
- Operations are **commutative** where possible (move operations don't depend on order)
- Conflict resolution via **timestamp** - later timestamp wins
- Undo/redo via **inverse operations** (add ↔ delete, move ↔ move back)

**Why:** State-based sync requires sending entire canvas on every change. Operation-based only sends deltas (100x smaller payloads). Undo/redo is free because we just apply inverse operations.

**2. Map-Based Storage (Not Array)**

- `allStrokesRef` is a `Map<strokeId, stroke>` not `Array<stroke>`
- O(1) lookups by ID instead of O(n) array scans
- Array ↔ Map conversion at DB boundaries only

**Why:** With 1000+ strokes, searching arrays for every operation kills performance. Map lookups are instant.

**3. Unified Storage (Strokes + Text in Same Map)**

- Text objects stored as `{id, type: 'text', text, x, y, fontSize, ...}`
- Regular strokes stored as `{id, points: [{x,y}], config, ...}`
- Same operation system handles both

**Why:** Separate text layer would require duplicate infrastructure. Unified storage means text gets selection/move/delete/undo for free.

**4. Refs Everywhere (Not State)**

- Canvas, strokes, selections, undo/redo stacks all use `useRef`
- Only UI settings (brush color, zoom level) use `useState`

**Why:** React re-renders on state change. Drawing operations happen 60fps - re-rendering contexts on every stroke point would murder performance. Refs bypass React's render cycle.

**5. Event Delegation for Mode Handlers**

- `useDraw` orchestrates all modes via priority routing
- Each mode returns `{handled: boolean}`
- Priority: Pan → Transform → Insert → Select → Draw → Text

**Why:** Avoids spaghetti if/else chains. Each mode is isolated, testable, and easy to add/remove.

---

## Database Schema

### Tables (6 total)

**User**

```sql
- id (UUID, PK)
- email (unique, indexed)
- username (unique, indexed)
- passwordHash (bcrypt)
- displayName
- avatarUrl (TEXT - base64 data URL, see Avatar System below)
- createdAt, updatedAt
```

**Canvas**

```sql
- id (UUID, PK)
- title
- description
- data (JSONB - array of strokes/text)
- thumbnailUrl (unused, future feature)
- isPublic (for templates/showcase)
- isTemplate (for canvas duplication)
- ownerId (FK → User)
- createdAt, updatedAt, lastAccessedAt (indexed)
```

**Collaboration**

```sql
- id (UUID, PK)
- canvasId (FK → Canvas)
- userId (FK → User)
- role (ENUM: VIEWER, EDITOR, ADMIN)
- createdAt
- UNIQUE(canvasId, userId)
```

**Tag**

```sql
- id (UUID, PK)
- name (unique, indexed)
```

**CanvasTag** (Junction table)

```sql
- canvasId (FK → Canvas)
- tagId (FK → Tag)
- PK: (canvasId, tagId)
```

**Session**

```sql
- id (UUID, PK)
- userId (FK → User)
- token (JWT string, indexed)
- expiresAt
- createdAt
```

### Permission System

**Roles:**

- **Owner** - Full control (edit, delete, manage collaborators, share link)
- **ADMIN** - Manage collaborators, edit canvas (cannot delete canvas)
- **EDITOR** - Edit canvas only
- **VIEWER** - Read-only

**Share Links:**

- Canvas has `shareToken` (nullable UUID) + `shareRole` (EDITOR/VIEWER)
- `linkSharingEnabled` boolean to disable link
- Rotating token invalidates old links, kicks anonymous users via Socket.IO broadcast

---

## Frontend Architecture

### Component Organization

```
components/
├── canvas/          - CanvasBoard, CanvasHeader, InlineTextEditor, ViewportControls
├── toolbars/        - BrushToolbar, PropertiesSidebar, ShapePickerPanel, MenuButton
├── collaboration/   - UserPresence, CollaborationPanel, ShareLinkJoinModal
├── auth/            - ProtectedRoute, UserMenu
├── profile/         - AvatarUpload, ProfileForm, PasswordChangeForm
├── modals/          - Modal, TextInputModal
├── banners/         - AnonymousBanner, LocalCanvasBanner
└── ui/              - HelpButton
```

### Context Architecture

**AuthContext** - JWT auth state (user, token, login/register/logout)

**CanvasContext** - Unified stroke storage (`allStrokesRef` Map), selection state, undo/redo stacks

**AppStateContext** - Brush settings (color, width, lineDash, lineCap, lineJoin), brush type (1-6), grid toggle

**SocketContext** - Socket.IO connection, room management, user presence, operation broadcasting

**ViewportContext** - Zoom/pan state (0.1x-10x zoom, center-based transformations)

**CanvasPersistenceContext** - Orchestrates DB save/load, Socket.IO room joining, permissions, auto-save (2s debounce)

### Hook Architecture

**Core Hooks:**

- `useDraw` - Main orchestrator, integrates all mode handlers
- `useOperationManager` - Operation execution, inverse generation, broadcasting
- `useCollaborativeStrokes` - Remote operation handling, orange previews
- `useViewport` - Center-based zoom/pan with coordinate transformations

**Mode Handlers (Event Delegation Pattern):**

- `usePanMode` - Right-click drag to pan
- `useTransformMode` - Move/resize/rotate with 8 handles + rotation handle
- `useInsertShapeMode` - Drag-to-create shapes (brush type 3)
- `useSelectMode` - Rectangle/lasso selection with Ctrl modifiers
- `useDrawMode` - Freehand (type 1) or smart shapes (type 2)
- `useTextMode` - Click-to-add text with inline editor
- `useKeyboardMode` - Ctrl+Z/Y, Delete, Ctrl+A, Ctrl+C/V, Escape

**Utility Hooks:**

- `useCanvasHelpers` - getContext, getCanvasPoint, clearCanvas, drawStroke
- `useCanvasRenderer` - Centralized rendering pipeline
- `useCanvasAPI` - HTTP API calls (save/load/update canvas)
- `useAutoSave` - Debounced auto-save (2s delay)

### Drawing Pipeline

```
1. Mouse down → Mode handler creates operation
2. Operation executes locally (instant feedback)
3. Operation broadcasts to Socket.IO room
4. Remote clients receive → validate → execute
5. Inverse operation stored in undo stack
6. Render triggered via requestAnimationFrame
7. Auto-save debounces for 2s, then saves to DB
```

---

## Smart Shape Detection

### Dual-Check Algorithm

**Open vs Closed Detection:**

```javascript
const startToEndDist = distance(first, last);
const pathLength = totalPathLength(points);
const endpointRatio = startToEndDist / pathLength;

const isOpen = startToEndDist > 20 && endpointRatio > 0.3;
```

**Why dual-check:**

- Distance only: Small circles (25px) would be "open"
- Ratio only: Large arrows (150px apart) with long paths would be "closed"
- Both required: Circle (25px/300px = 8% ❌), Arrow (150px/160px = 94% ✓)

### Detection Priority

**Open shapes:**

1. Analyze curvature (path length vs straight distance)
2. If straightness > 0.95 → straight arrow
3. Else → curved arrow (adaptive Bezier segments based on inflection count)

**Closed shapes:**

1. Circle (lowest convexity: perimeter² / area ≤ 15)
2. Triangle (max inscribed triangle area / convex hull area ≥ 0.9)
3. Rectangle (convex hull perimeter / bounding rect perimeter ≥ 0.9)
4. If aspect ratio > 5 → re-classify as arrow (too thin)

### Adaptive Curved Arrows

**Auto-segmentation:**

```javascript
const numSegments = min(max(2, ceil(inflectionCount / 2) + 1), 4);
```

- 0-1 inflections → 2 segments (simple curve)
- 2 inflections → 2 segments (S-curve)
- 3-4 inflections → 3 segments
- 5+ inflections → 4 segments (U-curves, spirals)

**C1 Continuity:**

- Join points have aligned tangents between segments
- Arrow head trimmed 60% of length to avoid collision with curve

---

## Collaboration System

### Socket.IO Architecture

**Server (index.js):**

```javascript
io.on("connection", (socket) => {
  // Events:
  socket.on("join:room", { canvasId, inviteToken });
  socket.on("operation", operation);
  socket.on("cursor:move", { x, y });

  // Broadcasts:
  io.to(roomId).emit("room:joined", { users, operations, myUserInfo });
  io.to(roomId).emit("operation", operation);
  io.to(roomId).emit("cursor:update", { userId, x, y });
  io.to(roomId).emit("permission-changed", { userId, newRole });
  socket.emit("access-revoked");
});
```

**Client (SocketContext):**

- Immortal listeners registered at context level
- Handler functions swapped via refs (prevents dropped operations on re-render)
- Operation validation before execution (checks userId, timestamp)

### Anonymous User System

**Persistent ID Management:**

```javascript
// localStorage keys:
anonymousUserId: crypto.randomUUID(); // Persists across sessions
anonymousUsername: "Mysterious Platypus"; // Random adjective + animal
```

**Why persistent IDs:**

- Socket.id changes on reconnect → strokes would be orphaned
- localStorage IDs survive page refresh
- Server sends `myUserInfo` in `room:joined` with persistent ID

### Real-Time Permission Changes

**Flow:**

1. Owner/ADMIN changes role via CollaborationPanel
2. Server updates DB, broadcasts `permission-changed` event
3. Affected user receives event → **force page refresh** via `window.location.reload()`

**Why force refresh:**

- Role affects 50+ components (toolbars, buttons, menus)
- State sync across all contexts = complex and error-prone
- Refresh is 200ms hiccup but guarantees consistency

**Alternative (rejected):**

- Update `userRole` state + propagate to all consumers
- Risk: Stale closures, missed updates, UI desyncs
- Not worth the complexity for rare permission changes

---

## Avatar Upload System

### Implementation: Base64-in-DB (Not File Storage)

**Why NOT file storage:**

- No filesystem permissions needed
- No static file serving setup
- No cleanup logic for orphaned files
- Simpler deployment (just DB backup)
- DB is already replicated/backed up

**Processing Pipeline:**

1. **Client:** File → FileReader → base64 data URL
2. **Client → Server:** JSON payload `{ avatarData: "data:image/png;base64,..." }`
3. **Server (Sharp processing):**
   - Validate format (JPEG/PNG/GIF/WebP only, **block SVG** for XSS)
   - Validate dimensions (max 10000×10000, prevent zip bombs)
   - Resize to 200×200 (cover fit)
   - Convert to WebP quality 80 (~30KB after compression)
   - Strip all EXIF metadata (security)
   - 10s timeout (prevent DoS)
4. **Server → DB:** Store `data:image/webp;base64,...` in `User.avatarUrl`
5. **Client:** Direct `<img src={user.avatarUrl}>` (no URL construction)

**Security Measures:**

- Regex validation of data URL format
- 15MB client + server size limits
- Sharp metadata check (rejects non-images)
- SVG blocked (can contain embedded scripts)
- Dimension validation (reject > 10000×10000)
- Metadata stripping via `.withMetadata(false)`
- Processing timeout (10s max via Promise.race)
- Error sanitization (don't leak Sharp internals)

**Tradeoffs:**

- ✅ Simple deployment, portable DB, easy backups
- ❌ Larger DB size (~30KB/avatar), slower queries if not selective
- **Mitigation:** Always use Prisma `select` to exclude avatarUrl when not needed

**Future Improvements:**

- Lazy-load avatars (separate API endpoint)
- CDN integration (S3, Cloudinary)
- Multiple sizes (thumbnail vs full)

---

## Text System

### Architecture: Text as Special Strokes

**Why not separate text layer:**

- Reuses existing infrastructure (operations, undo/redo, collaboration, selection, persistence)
- No parallel storage/rendering/export logic needed
- Text gets move/resize/delete for free

**Text Object Structure:**

```javascript
{
  id: 'text_abc123',
  type: 'text',
  text: 'Hello\nWorld',      // Multiline support
  x: 100,                     // Canvas coords (left edge)
  y: 200,                     // Baseline position
  fontSize: 16,
  config: { color: '#000000', fontFamily: 'Comic Sans MS' },
  attachedTo: null,           // Shape ID for annotations (future)
  bbox: { minX, maxX, minY, maxY }, // Multiline-aware
  userId, username,
  isTemporary: true           // Live preview flag
}
```

**Inline Editing (PowerPoint-style):**

1. Click canvas → `InlineTextEditor` appears at click position
2. Temporary text object created with `isTemporary: true`
3. Type → live preview renders (filtered from DB save)
4. Submit (Ctrl+Enter / click away) → remove `isTemporary` → broadcast `TEXT_ADD`

**Why inline (not modal):**

- More natural UX (like Figma, PowerPoint)
- Text renders in real position as you type
- Click-away-to-submit via `textEditorRef.blur()` (Canvas clicks trigger blur)

**Operations:**

- `TEXT_ADD` - Creates text with multiline bbox (canvas.measureText per line)
- `TEXT_EDIT` - Updates text, recalculates bbox (double-click)
- `TEXT_DELETE` - Removes from Map
- `STROKE_MOVE` - Special handling: updates `{x, y}` not `points[]`
- `STROKE_RESIZE` - Scales fontSize + position (allows negative scale for flip)
- `STROKE_ROTATE` - Rotates position, text stays upright

**Transform Gotchas :**

- Move: Store `{x, y}` not `points` array
- Resize preview: Update `{x, y, fontSize}` not `points`
- Resize scale: Use `Math.abs((scaleX + scaleY)/2)` for fontSize (prevent negative)
- Restore on cancel: Restore `{x, y, fontSize}` not `points`

---

## Copy/Paste System

### Architecture: Batch Operations + ID Remapping

**Flow:**

1. User selects strokes (rectangle/lasso/Ctrl+click)
2. Ctrl+C → calculate bbox center, deep clone strokes
3. **Auto-include attached text:** If copying shape, scan for `attachedTo === shapeId`
4. Store `originalId` on copied objects for ID remapping
5. Ctrl+V → paste centered at **last mouse position** (tracked in `lastMousePosRef`)
6. **Two-pass ID remapping:**
   - Pass 1: Generate new IDs, build `Map<oldId, newId>`
   - Pass 2: Create strokes with new IDs, remap `attachedTo` using map
7. Translate by offset: `cursorPos - copiedCenter`
8. `batchAddStrokes()` → single undo entry + single broadcast
9. Auto-select pasted content

**Why cursor position (not center/fixed offset):**

- Standard pattern (Figma, Sketch, Photoshop)
- Intuitive for duplicating at specific location
- Keyboard shortcuts don't have mouse coords → track via `lastMousePosRef`

**Batch Operation Benefits:**

- Single undo/redo entry (even with 100 strokes)
- Single broadcast packet (efficient for collaboration)
- Atomic operation (all-or-nothing)

**ID Remapping Example:**

```javascript
// Original
shape_old → { attachedTo: null }
text_old  → { attachedTo: 'shape_old' }

// After paste
shape_new → { attachedTo: null }
text_new  → { attachedTo: 'shape_new' } // Remapped via Map lookup
```

---

## Performance Optimizations

### Drawing Performance

**0.7px Distance Filtering (Capture Time):**

```javascript
if (distance(lastPoint, currentPoint) < 0.7) return; // Skip point
```

- Reduces point count by 60-80%
- No visual quality loss (sub-pixel precision)

**60fps Throttling:**

```javascript
if (Date.now() - lastDrawTime < 16.67) return; // ~60fps
```

- Prevents mouse move spam (browsers fire at 120-240fps)

**requestAnimationFrame Rendering:**

```javascript
requestAnimationFrame(() => {
  drawRemoteOngoingStrokes();
  drawUserCursors();
});
```

- Smooth remote stroke preview
- Batches multiple updates per frame

**RDP Simplification (Shape Detection):**

```javascript
simplify(points, (epsilon = 4)); // Ramer-Douglas-Peucker
```

- Lasso: 200+ points → ~20 points before intersection tests
- Smart shapes: Reduces noise for better detection

### Collaboration Performance

**Map Storage (O(1) Lookups):**

- `allStrokesRef.current.get(strokeId)` vs `array.find(s => s.id === strokeId)`
- With 1000 strokes: 1ms vs 100ms per lookup

**Operation Batching:**

- Room join: Convert DB strokes to `STROKE_ADD` operations, send all at once
- Paste: Single `BATCH_ADD_STROKES` instead of 100 individual adds

**Debounced Auto-Save:**

```javascript
useAutoSave(getCanvasData, saveCanvas, 2000); // 2s debounce
```

- Prevents DB spam during active drawing

### Rendering Optimizations

**Viewport Culling (Future):**

```javascript
// Not implemented yet, but should be:
if (bbox outside viewport) skip rendering
```

**Layer Caching:**

- `tempCanvasImgRef` stores completed strokes as image
- Only redraw ongoing stroke, not entire canvas

---

## Security

### Rate Limiting

**Limits (express-rate-limit):**

- Login: 5 attempts per 15min per IP
- Avatar upload: 10 per hour per user
- Password change: 3 per hour per user
- Canvas creation: 20 per hour per user
- General API: 100 requests per 15min per IP

### Authentication

**JWT Tokens:**

- httpOnly cookies (not localStorage, prevents XSS)
- 7-day expiration (configurable via JWT_EXPIRES_IN env var)
- Validated on every API request via `auth.js` middleware
- Session stored in DB for server-side invalidation

**Password Security:**

- bcrypt hashing (10 rounds)
- No password in responses (Prisma select excludes `passwordHash`)

### Input Validation

**Avatar Upload:**

- File type whitelist (JPEG/PNG/GIF/WebP only)
- SVG blocked (XSS risk)
- Size limits: 15MB client, 15MB server
- Dimension limits: 10000×10000 max
- Sharp metadata validation (rejects non-images)
- Processing timeout (10s DoS prevention)

**Text Input:**

- XSS prevention: Block `<`, `>`, `&` characters
- 10,000 character limit
- Multiline allowed (split on `\n`)

**ReDoS Prevention:**

- Replaced regex `/^data:image\/\w+;base64,(.+)$/` with string operations
- Old pattern: catastrophic backtracking on long strings
- New pattern: `indexOf(',')` + `substring()` = O(1)

### Logging (Winston)

**Structured Logging:**

```javascript
logger.info("User joined room", {
  socketId: logger.sanitizeSocketId(socket.id),
  user: logger.sanitizeUser(user),
  canvasId: logger.sanitizeId(roomId),
  role,
});
```

**PII Sanitization:**

- Usernames: Show first 3 chars + `***` (e.g., `"Ali***"`)
- IDs: Truncate to 8 chars (e.g., `"a1b2c3d4..."`)
- Socket IDs: Hash with crypto

**Log Levels:**

- Development: `debug` (all logs)
- Production: `info` (errors + key events)

---

## Critical Bug Fixes 

### Unified Storage Refactor

**Problem:** Dual storage (Array for DB, Map for operations) → split-brain

**Symptoms:**

- DB-loaded strokes in `finishedStrokesRef` array
- Remote operations only checked `remoteStrokesRef` Map
- Broadcasts failed after page refresh

**Root Cause:**

```javascript
// Before (BROKEN)
const finishedStrokesRef = useRef([]); // DB strokes
const remoteStrokesRef = useRef(new Map()); // Remote strokes

// Operation checks Map, misses DB strokes
if (!remoteStrokesRef.current.has(strokeId)) return;
```

**Solution:** Single source of truth

```javascript
// After (FIXED)
const allStrokesRef = useRef(new Map()); // ALL strokes

// Array ↔ Map conversion only at DB boundaries
const strokes = Array.from(allStrokesRef.current.values());
```

**Lesson:** Never split related data across incompatible structures.

### Socket Listener Lifecycle

**Problem:** Listeners re-attached when `operationManager` changed → dropped operations

**Symptoms:**

- Operations lost during room join
- Remote strokes vanished randomly

**Root Cause:**

```javascript
// Before (BROKEN)
useEffect(() => {
  socket.on("operation", (op) => operationManager.execute(op));
  return () => socket.off("operation");
}, [operationManager]); // Re-runs when manager changes!
```

**Solution:** Immortal listeners + callback refs

```javascript
// After (FIXED)
// In SocketContext (top level, runs once):
socket.on("operation", (op) => {
  if (operationHandlerRef.current) {
    operationHandlerRef.current(op);
  }
});

// Consumers update handler via ref (no re-mount):
operationHandlerRef.current = operationManager.execute;
```

**Lesson:** Socket listeners should outlive the handlers they call. Use refs for handler updates.

### Anonymous User Stroke Broadcasting

**Problem:** Guest strokes rendered locally but didn't sync to other users

**Root Cause:**

```javascript
// Before (BROKEN)
const userId = socket.id; // Changes on reconnect!
```

**Solution:**

```javascript
// After (FIXED)
const userId = myUserInfo.userId; // Persistent anonymousId from localStorage
```

**Lesson:** Never use socket.id as userId. Always use persistent IDs.

### Text Transform Operations

**Problem:** Text move/resize/rotate failed due to points-based logic

**Symptoms:**

- Text snapped back after move
- No resize/rotate preview
- Crash on mouse up

**Root Cause:**

```javascript
// Before (BROKEN)
const originalPoints = [...stroke.points]; // Text has no points!
```

**Solution:** Parallel code paths

```javascript
// After (FIXED)
if (stroke.type === "text") {
  const original = { x: stroke.x, y: stroke.y, fontSize: stroke.fontSize };
  // ... text-specific transform logic
} else {
  const originalPoints = [...stroke.points];
  // ... points-based transform logic
}
```

**Lesson:** When mixing data structures, every operation needs a parallel path.

---

## Future Enhancements

**Planned (Not Implemented):**

- SVG export
- Drag-and-drop import
- Texture library (pencil/marker/chalk brushes)
- Pressure-sensitive width (tablet support)
- Custom shape saving
- Canvas templates
- Advanced sharing controls (expiring links, view counts)
- Viewport culling (don't render off-screen strokes)
- Layer system (z-index management)
- Text rotation (requires transform matrix)
- Font selector (currently hardcoded Comic Sans MS)
- Collaborative cursors with username labels (currently red dots only)

---

## Running the Project

**Development:**

```bash
npm install
npm run dev  # Starts client (5173) + server (3001)
```

**Production Build:**

```bash
npm run build
npm start
```

**Environment Variables:**

```bash
# Server (.env)
DATABASE_URL="postgresql://user:pass@localhost:5432/canvas_db"
JWT_SECRET="generate-with-openssl-rand-hex-64"
JWT_EXPIRES_IN="7d"
PORT=3001

# Client (Vite reads from .env)
VITE_API_URL="http://localhost:3001"
```

**Database Setup:**

```bash
cd server
npx prisma migrate dev  # Run migrations
npx prisma studio      # GUI database browser
```

---

## Key Files Reference

**Client:**

- `src/hooks/useDraw.js` - Main drawing orchestrator (515 lines)
- `src/hooks/useOperationManager.js` - Operation execution + undo/redo (400+ lines)
- `src/contexts/SocketContext.jsx` - Socket.IO client wrapper (300+ lines)
- `src/contexts/CanvasPersistenceContext.jsx` - DB + room orchestration (400+ lines)
- `src/components/canvas/CanvasBoard.jsx` - Canvas wrapper component (300+ lines)
- `src/utils/geometry.js` - Computational geometry (695 lines, 31 functions)
- `src/utils/detectShape.js` - Smart shape detection (190 lines)
- `src/utils/drawShape.js` - Shape generation (372 lines)

**Server:**

- `server/index.js` - Socket.IO server + room management (300+ lines)
- `server/controllers/canvasController.js` - Canvas CRUD + permissions (400+ lines)
- `server/controllers/authController.js` - JWT auth (200+ lines)
- `server/controllers/userController.js` - Profile + avatar (200+ lines)
- `server/middleware/auth.js` - JWT validation (50 lines)
- `server/middleware/rateLimiter.js` - Rate limit configs (100 lines)
- `server/utils/logger.js` - Winston setup + sanitization (150 lines)

**Database:**

- `server/prisma/schema.prisma` - 6 tables, relationships, indexes (200 lines)

---

## Glossary

**Operation:** A serializable action (add/delete/move/resize/rotate) with type, payload, userId, timestamp, inverse

**Inverse Operation:** Undo operation (e.g., ADD inverse is DELETE with same strokeId)

**Stroke:** A drawn path or shape, stored as `{id, points: [{x,y}], config}`

**Text:** Special stroke with `type: 'text'`, stored as `{id, type, text, x, y, fontSize, bbox}`

**Bbox:** Bounding box `{minX, maxX, minY, maxY}` for hit testing and selection

**Lasso:** Freehand polygon selection (brush type 5)

**RDP:** Ramer-Douglas-Peucker algorithm for stroke simplification

**Convex Hull:** Smallest convex polygon containing all points

**Rotating Calipers:** Algorithm for minimum-area bounding rectangle

**C1 Continuity:** Curve segments join with aligned tangents (smooth transitions)

**Dual-Check:** Open/closed detection requiring BOTH distance > 20px AND ratio > 30%

**Anonymous User:** Guest user with persistent localStorage ID (anonymousUserId)

**Share Link:** Public URL with invite token for guest access

**Room:** Socket.IO namespace for a single canvas (all collaborators join room)

**Orange Preview:** Remote user's ongoing stroke (not yet completed)

**Temporary Text:** Text with `isTemporary: true`, renders live but excluded from DB save
