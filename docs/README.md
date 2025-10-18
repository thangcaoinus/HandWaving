# Documentation Index

Welcome to the HandWaving documentation. This is your memory dump - everything you need to remember how this thing works 6 months from now.

> 🤖 **AI-Generated Docs Alert!** These docs were written by Claude during pair programming sessions. They're detailed and (hopefully) accurate, but remember: AI makes mistakes. When something looks fishy, check the actual code. The code never lies (except when it has bugs, but that's a different problem).

---

## Quick Links

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture, data flow, tech stack decisions
- **[API.md](./API.md)** - Server API endpoints reference (TODO: create this)
- **[COLLABORATION.md](./COLLABORATION.md)** - Deep dive into Socket.IO + operations (TODO: create this)

---

## What This Project Is

A collaborative whiteboard that:
1. Detects hand-drawn shapes (circles, rectangles, triangles, arrows) and snaps them to perfect geometry
2. Supports real-time collaboration via Socket.IO (operation-based sync, not state-based)
3. Has a full permission system (Owner/ADMIN/EDITOR/VIEWER + share links for guests)
4. Stores everything in PostgreSQL with Prisma ORM
5. Uses JWT auth with httpOnly cookies + anonymous guest support

**Tech:** React + Vite, Tailwind CSS, Socket.IO, PostgreSQL + Prisma, Winston logging

---

## For First-Time Readers

**Start here:**
1. Read the "Overview" and "System Architecture" sections in [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Look at the "Data Flow" diagram to understand how operations work
3. Check "Key Architectural Decisions" to understand why we made certain choices
4. Jump to specific sections as needed (e.g., "Smart Shape Detection", "Collaboration System")

**If you're debugging:**
1. Check "Critical Bug Fixes" section for war stories and lessons learned
2. Look at "Key Files Reference" to find the relevant file
3. Use the glossary if you forgot what "C1 continuity" or "rotating calipers" means

---

## Project Structure

```
HandWaving/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # UI components (organized by job)
│   │   │   ├── canvas/        # CanvasBoard, CanvasHeader, etc.
│   │   │   ├── toolbars/      # BrushToolbar, PropertiesSidebar, etc.
│   │   │   ├── collaboration/ # UserPresence, CollaborationPanel, etc.
│   │   │   ├── auth/          # ProtectedRoute, UserMenu
│   │   │   ├── profile/       # AvatarUpload, ProfileForm, etc.
│   │   │   ├── modals/        # Modal components
│   │   │   ├── banners/       # Anonymous/LocalCanvas banners
│   │   │   └── ui/            # Generic UI (HelpButton, etc.)
│   │   ├── contexts/          # React contexts (Auth, Socket, Canvas, etc.)
│   │   ├── hooks/             # Custom hooks
│   │   │   └── drawing/       # Drawing-related hooks
│   │   │       └── modes/     # Mode handlers (Pan, Draw, Select, etc.)
│   │   ├── pages/             # Route pages (Landing, Gallery, Profile, etc.)
│   │   └── utils/             # Utility functions (geometry, shapes, etc.)
│   └── package.json
│
├── server/                    # Node.js backend
│   ├── controllers/           # Request handlers (auth, canvas, user, etc.)
│   ├── middleware/            # Express middleware (auth, rate limiting)
│   ├── routes/                # API route definitions
│   ├── utils/                 # Server utilities (logger, jwt, etc.)
│   ├── prisma/                # Database schema + migrations
│   │   └── schema.prisma
│   ├── index.js               # Main server + Socket.IO
│   └── package.json
│
├── docs/                      # Documentation (you are here)
│   ├── README.md              # This file
│   ├── ARCHITECTURE.md        # System architecture
│   ├── API.md                 # API reference (TODO)
│   └── COLLABORATION.md       # Collaboration deep dive (TODO)
│
├── package.json               # Root workspace config
└── README.md                  # User-facing README
```

---

## Development Workflow

**Starting development:**
```bash
npm install          # Install all dependencies (client + server)
npm run dev          # Start dev servers (client on 5173, server on 3001)
```

**Common tasks:**
```bash
npm run build        # Build client for production
npm run lint         # Run ESLint
cd server && npx prisma studio  # Open database GUI
cd server && npx prisma migrate dev  # Create new migration
```

**Testing collaboration:**
1. Open http://localhost:5173 in 2+ browser tabs
2. Login to different accounts (or one auth + one guest via share link)
3. Draw in one tab, should appear in others in real-time

**Testing anonymous users:**
1. Create a canvas as authenticated user
2. Generate share link (Share button → copy link)
3. Open link in incognito window
4. Should see guest join modal → accept → collaborate as "Anonymous Platypus"

---

## Key Concepts to Remember

### Operation-Based Architecture
Every change is an **operation** (not a state snapshot). Operations have:
- Type (STROKE_ADD, STROKE_DELETE, STROKE_MOVE, etc.)
- Payload (strokeId, points, config, etc.)
- UserId + Username (for attribution)
- Timestamp (for conflict resolution)
- Inverse (for undo/redo)

**Why this matters:**
- Undo/redo is free (just apply inverse operations)
- Collaboration is efficient (send deltas, not entire canvas)
- Conflict resolution is deterministic (timestamp wins)

### Map-Based Storage
`allStrokesRef` is a `Map<strokeId, stroke>`, not an array.

**Why this matters:**
- O(1) lookups by ID (array.find is O(n))
- With 1000+ strokes, this is the difference between 1ms and 100ms
- Array ↔ Map conversion only happens at DB boundaries

### Refs vs State
Canvas, strokes, selections use `useRef`. Only UI settings use `useState`.

**Why this matters:**
- State changes trigger re-renders
- Drawing operations happen 60fps → re-rendering would kill performance
- Refs bypass React's render cycle entirely

### Event Delegation for Modes
Each mode handler returns `{handled: boolean}`. Priority: Pan → Transform → Insert → Select → Draw → Text.

**Why this matters:**
- Clean separation of concerns
- Easy to add/remove modes
- No spaghetti if/else chains

---

## Common Debugging Scenarios

### "Strokes disappear after page refresh"
- **Likely cause:** Not saving to DB (check auto-save is enabled)
- **Check:** `CanvasPersistenceContext` → `useAutoSave` → 2s debounce
- **Fix:** Manual save via MenuButton or wait 2s after last change

### "Remote strokes don't appear"
- **Likely cause:** Socket.IO not connected or operation validation failing
- **Check 1:** Console for "User joined room" logs
- **Check 2:** Browser Network tab → WS connection to localhost:3001
- **Check 3:** Server logs for operation validation errors
- **Fix:** Check `userId` matches between operation and socket

### "Selection/transform broken"
- **Likely cause:** Points vs text coordinate mismatch
- **Check:** Is it a text object? (`stroke.type === 'text'`)
- **Fix:** Use `{x, y, fontSize}` for text, `points` array for strokes

### "Anonymous user can't edit"
- **Likely cause:** Role is VIEWER, not EDITOR
- **Check:** `myUserInfo.role` in SocketContext
- **Fix:** Canvas share link should have `shareRole=EDITOR`, not VIEWER

### "Build fails after moving components"
- **Likely cause:** Import paths not updated
- **Check:** Error message shows old path like `'../components/CanvasBoard'`
- **Fix:** Update to new path like `'../components/canvas/CanvasBoard'`

---

## Security Considerations

**What we do:**
- Rate limiting on login (5/15min), avatar upload (10/hour), canvas creation (20/hour)
- JWT tokens in httpOnly cookies (not localStorage → prevents XSS)
- bcrypt password hashing (10 rounds)
- Input validation (avatar: file type, size, dimensions; text: XSS character blocking)
- ReDoS prevention (no catastrophic backtracking in regex)
- Winston logging with PII sanitization (usernames truncated, IDs hashed)
- EXIF metadata stripping from avatars (prevents location leaks)

**What we don't do (yet):**
- CSRF tokens (should add for state-changing requests)
- Content Security Policy headers
- SQL injection protection beyond Prisma (Prisma parameterizes queries, but watch raw queries)
- DDoS protection at infrastructure level (just app-level rate limiting)

---

## Performance Notes

**Fast:**
- Map storage (O(1) lookups)
- 0.7px distance filtering (60-80% fewer points)
- 60fps throttling (prevents mouse spam)
- requestAnimationFrame rendering (smooth 60fps)
- RDP simplification (200+ points → ~20 for shape detection)
- Debounced auto-save (2s delay prevents DB spam)

**Slow (TODO: fix):**
- No viewport culling (renders all strokes even if off-screen)
- No layer caching (redraws entire canvas on every change)
- No Web Worker for shape detection (blocks main thread)
- No IndexedDB for large canvases (localStorage has 5MB limit)

**Optimization opportunities:**
1. Viewport culling (don't render strokes outside visible area)
2. Quadtree spatial indexing (faster hit testing)
3. OffscreenCanvas for background rendering
4. Web Worker for RDP simplification + shape detection
5. Lazy-load avatars (separate API endpoint instead of embedding in user object)

---

## Contributing Guidelines

**Before making changes:**
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
2. Check "Critical Bug Fixes" to avoid repeating past mistakes
3. Run `npm run lint` to catch issues early

**Commenting guidelines:**
See `/DOCUMENTATION_STRATEGY.md` for when/how to comment. TL;DR:
- Comment WHY, not WHAT
- File-level comments at top (purpose + key details)
- Function-level comments for complex algorithms
- Inline comments for tricky logic
- NO JSDoc (we're not publishing a library)
- NO obvious comments (`// increment i`)

**Component organization:**
- Canvas-related → `components/canvas/`
- Toolbars → `components/toolbars/`
- Collaboration → `components/collaboration/`
- Auth → `components/auth/`
- Profile → `components/profile/`
- Modals → `components/modals/`
- Generic UI → `components/ui/`

**Commit messages:**
- Use imperative mood ("Add feature" not "Added feature")
- Be specific ("Fix text resize negative scale bug" not "Fix bug")
- Reference issue numbers if applicable

---

## Deployment Notes

**Environment variables needed:**
```bash
# Server
DATABASE_URL="postgresql://..."
JWT_SECRET="..."              # Generate with: openssl rand -hex 64
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="production"

# Client (Vite)
VITE_API_URL="https://your-api-domain.com"
```

**Database migrations:**
```bash
cd server
npx prisma migrate deploy  # Run pending migrations (production)
npx prisma generate        # Generate Prisma client
```

**Build process:**
```bash
npm run build              # Builds client to client/dist
# Serve client/dist with Nginx/Caddy/etc.
# Run server with: cd server && npm start
```

**CORS setup:**
Server needs to allow client origin:
```javascript
// server/index.js
io(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});
```

---

## Troubleshooting

### Database Issues

**"Can't connect to database"**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL

# Check schema is up to date
cd server && npx prisma migrate status
```

**"Migration failed"**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or manually fix migration
npx prisma migrate resolve --rolled-back <migration_name>
```

### Socket.IO Issues

**"Client can't connect"**
- Check server is running on correct port (3001)
- Check CORS settings allow client origin
- Check firewall not blocking WebSocket connections
- Browser console should show WS connection in Network tab

**"Operations not broadcasting"**
- Check `socket.emit('operation', op)` on client
- Check `io.to(roomId).emit('operation', op)` on server
- Check room ID matches (console.log both sides)

### Build Issues

**"Module not found"**
- Check import paths are correct (relative to file location)
- Check file actually exists at that path
- Check case sensitivity (Linux is case-sensitive, macOS isn't)

**"Vite build fails"**
- Check for circular dependencies
- Check all imports resolve
- Clear node_modules and reinstall

---

## Learning Resources

**Concepts used in this project:**
- **Computational Geometry:** Convex hull, rotating calipers, ray casting
- **Curve Fitting:** Bezier curves, RDP simplification, C1 continuity
- **Real-Time Collaboration:** Operational transformation (OT), CRDTs, WebSockets
- **React Patterns:** Refs vs state, context API, custom hooks, event delegation
- **Database Design:** Prisma ORM, foreign keys, indexes, JSONB columns
- **Security:** JWT, bcrypt, rate limiting, input validation, XSS/ReDoS prevention

**External reading:**
- Convex Hull: Wikipedia "Graham scan" + "Andrew's algorithm"
- Rotating Calipers: "Minimum Bounding Rectangle" algorithm
- Bezier Curves: "A Primer on Bezier Curves" by Pomax
- Operational Transformation: "Understanding and Applying OT" by Google Docs team
- React Performance: "Before You memo()" by Dan Abramov

---

**Remember:** This documentation is for YOU. Future you will thank present you for writing this down. When in doubt, over-document rather than under-document.
