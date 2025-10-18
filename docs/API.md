# API Reference

> 🤖 **AI-Generated Docs Alert!** This API reference was written by Claude during development. It's detailed and (hopefully) accurate, but AI isn't infallible. When something looks wrong, check the actual controller code in `server/controllers/`. The code never lies (except when it has bugs, but that's what debugging is for).

---

## Base URL

**Development:** `http://localhost:3001`
**Production:** Set via `VITE_API_URL` environment variable

All endpoints return JSON unless specified otherwise.

---

## Authentication

Most endpoints require JWT authentication via **httpOnly cookies**. The cookie is automatically sent by the browser after login.

**Auth Flow:**
1. `POST /api/auth/register` or `POST /api/auth/login` → receives JWT in httpOnly cookie
2. Subsequent requests automatically include cookie
3. Server validates token via `auth.js` middleware
4. `POST /api/auth/logout` → clears cookie

**Anonymous Users:**
- Can join canvases via share links (no API calls, Socket.IO only)
- Cannot access any REST endpoints (all require auth)

---

## Response Format

**Success (200-299):**
```json
{
  "message": "Success message",
  "data": { ... }
}
```

**Error (400-599):**
```json
{
  "error": "Error message",
  "details": "Optional additional info"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created (e.g., new canvas, new user)
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Server error

---

## Rate Limits

Applied per IP address or per user (varies by endpoint):

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/login` | 5 requests | 15 minutes |
| `POST /api/users/profile/avatar` | 10 requests | 1 hour |
| `PUT /api/users/password` | 3 requests | 1 hour |
| `POST /api/canvases` | 20 requests | 1 hour |
| General API | 100 requests | 15 minutes |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

---

## Endpoints

### Authentication

#### Register New User

```http
POST /api/auth/register
```

**Body:**
```json
{
  "email": "user@example.com",
  "username": "cooluser123",
  "password": "securepassword"
}
```

**Validation:**
- Email: Valid email format, unique
- Username: 3-20 chars, alphanumeric + underscore, unique
- Password: Min 6 chars (should be stronger in production)

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "username": "cooluser123",
    "displayName": "cooluser123",
    "avatarUrl": null,
    "createdAt": "2025-10-15T12:34:56.789Z"
  }
}
```

**Sets cookie:** `token` (httpOnly, 7 days)

---

#### Login

```http
POST /api/auth/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "username": "cooluser123",
    "displayName": "Cool User",
    "avatarUrl": "data:image/webp;base64,..."
  }
}
```

**Rate Limited:** 5 attempts per 15min per IP

**Sets cookie:** `token` (httpOnly, 7 days)

---

#### Logout

```http
POST /api/auth/logout
```

**Auth:** Required

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Clears cookie:** `token`

**Side Effects:** Deletes session from database

---

#### Get Current User

```http
GET /api/auth/me
```

**Auth:** Required

**Response (200):**
```json
{
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "username": "cooluser123",
    "displayName": "Cool User",
    "avatarUrl": "data:image/webp;base64,..."
  }
}
```

**Use Case:** Check if user is logged in, get user info for UI

---

### Canvas Management

#### Create Canvas

```http
POST /api/canvases
```

**Auth:** Required

**Body:**
```json
{
  "title": "My Whiteboard",
  "description": "Optional description",
  "isPublic": false,
  "isTemplate": false
}
```

**Response (201):**
```json
{
  "message": "Canvas created successfully",
  "canvas": {
    "id": "canvas-uuid",
    "title": "My Whiteboard",
    "description": "Optional description",
    "data": [],
    "thumbnailUrl": null,
    "isPublic": false,
    "isTemplate": false,
    "ownerId": "user-uuid",
    "createdAt": "2025-10-15T12:34:56.789Z",
    "updatedAt": "2025-10-15T12:34:56.789Z",
    "lastAccessedAt": "2025-10-15T12:34:56.789Z"
  }
}
```

**Rate Limited:** 20 canvases per hour

---

#### Get All User's Canvases

```http
GET /api/canvases
```

**Auth:** Required

**Query Params:**
- `search` (optional) - Search in title/description
- `tags` (optional) - Comma-separated tag names (e.g., `tags=work,design`)
- `filter` (optional) - `owner` (my canvases) or `shared` (shared with me)
- `sort` (optional) - `updated` (default), `created`, `title`

**Response (200):**
```json
{
  "canvases": [
    {
      "id": "canvas-uuid",
      "title": "My Whiteboard",
      "description": "...",
      "thumbnailUrl": null,
      "isPublic": false,
      "ownerId": "user-uuid",
      "updatedAt": "2025-10-15T12:34:56.789Z",
      "lastAccessedAt": "2025-10-15T12:00:00.000Z",
      "owner": {
        "username": "cooluser123",
        "displayName": "Cool User"
      },
      "tags": [
        { "id": "tag-uuid", "name": "work" },
        { "id": "tag-uuid-2", "name": "design" }
      ],
      "collaboration": [
        {
          "id": "collab-uuid",
          "role": "EDITOR",
          "user": {
            "username": "alice",
            "displayName": "Alice"
          }
        }
      ]
    }
  ]
}
```

**Note:** `data` field is excluded (too large). Use `GET /api/canvases/:id` to load actual strokes.

---

#### Get Single Canvas

```http
GET /api/canvases/:id
```

**Auth:** Required OR valid `inviteToken` query param

**Query Params:**
- `inviteToken` (optional) - Share link token for anonymous access

**Permissions:**
- Owner: Full access
- Collaborator: Access based on role
- Anonymous with valid token: Access based on `shareRole`

**Response (200):**
```json
{
  "canvas": {
    "id": "canvas-uuid",
    "title": "My Whiteboard",
    "description": "...",
    "data": [
      {
        "id": "stroke-uuid",
        "points": [{"x": 100, "y": 200}, ...],
        "config": { "color": "#f08080", "lineWidth": 2 }
      },
      {
        "id": "text-uuid",
        "type": "text",
        "text": "Hello World",
        "x": 150,
        "y": 250,
        "fontSize": 16,
        "config": { "color": "#000000" }
      }
    ],
    "thumbnailUrl": null,
    "isPublic": false,
    "ownerId": "user-uuid",
    "linkSharingEnabled": true,
    "shareRole": "EDITOR",
    "owner": {
      "id": "user-uuid",
      "username": "cooluser123",
      "displayName": "Cool User"
    },
    "tags": [...],
    "collaboration": [...]
  },
  "userRole": "OWNER" | "ADMIN" | "EDITOR" | "VIEWER"
}
```

**Use Case:** Load canvas data for editing

---

#### Update Canvas

```http
PUT /api/canvases/:id
```

**Auth:** Required

**Permissions:** Owner, ADMIN, or EDITOR

**Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "description": "New description",
  "data": [...],
  "isPublic": false
}
```

**Response (200):**
```json
{
  "message": "Canvas updated successfully",
  "canvas": { ... }
}
```

**Auto-Save:** Called by `useAutoSave` hook with 2s debounce

**Note:** `data` field contains full stroke array (can be large)

---

#### Delete Canvas

```http
DELETE /api/canvases/:id
```

**Auth:** Required

**Permissions:** Owner only

**Response (200):**
```json
{
  "message": "Canvas deleted successfully"
}
```

**Side Effects:**
- Deletes all collaborations
- Deletes all canvas-tag associations
- Does NOT delete tags themselves

---

#### Duplicate Canvas

```http
POST /api/canvases/:id/duplicate
```

**Auth:** Required

**Permissions:** Any user with access to canvas

**Response (201):**
```json
{
  "message": "Canvas duplicated successfully",
  "canvas": {
    "id": "new-canvas-uuid",
    "title": "Copy of My Whiteboard",
    "data": [...],
    "ownerId": "current-user-uuid"
  }
}
```

**Note:** Copies data, tags, but NOT collaborators (new canvas is private to you)

---

### Tags

#### Add Tag to Canvas

```http
POST /api/canvases/:id/tags
```

**Auth:** Required

**Permissions:** Owner or ADMIN

**Body:**
```json
{
  "name": "work"
}
```

**Response (200):**
```json
{
  "message": "Tag added to canvas",
  "tag": {
    "id": "tag-uuid",
    "name": "work"
  }
}
```

**Creates tag if doesn't exist:** Tags are global, reused across canvases

---

#### Remove Tag from Canvas

```http
DELETE /api/canvases/:id/tags/:tagId
```

**Auth:** Required

**Permissions:** Owner or ADMIN

**Response (200):**
```json
{
  "message": "Tag removed from canvas"
}
```

**Does NOT delete tag:** Just removes association

---

### Collaboration

#### Get Collaborators

```http
GET /api/canvases/:id/collaborators
```

**Auth:** Required

**Permissions:** Any user with access to canvas

**Response (200):**
```json
{
  "collaborators": [
    {
      "id": "collab-uuid",
      "role": "EDITOR",
      "createdAt": "2025-10-15T10:00:00.000Z",
      "user": {
        "id": "user-uuid",
        "username": "alice",
        "displayName": "Alice",
        "avatarUrl": "data:image/webp;base64,..."
      }
    }
  ],
  "owner": {
    "id": "owner-uuid",
    "username": "bob",
    "displayName": "Bob",
    "avatarUrl": null
  },
  "linkSharingEnabled": true,
  "shareToken": "token-uuid",
  "shareRole": "EDITOR",
  "shareLink": "http://localhost:5173/canvas/canvas-uuid?inviteToken=token-uuid"
}
```

---

#### Add Collaborator

```http
POST /api/canvases/:id/collaborators
```

**Auth:** Required

**Permissions:** Owner or ADMIN

**Body:**
```json
{
  "usernameOrEmail": "alice",
  "role": "EDITOR"
}
```

**Valid Roles:** `VIEWER`, `EDITOR`, `ADMIN`

**Response (201):**
```json
{
  "message": "Collaborator added successfully",
  "collaboration": {
    "id": "collab-uuid",
    "role": "EDITOR",
    "user": {
      "username": "alice",
      "displayName": "Alice"
    }
  }
}
```

**Side Effects:** Broadcasts `collaborators-changed` Socket.IO event to room

---

#### Update Collaborator Role

```http
PATCH /api/canvases/:canvasId/collaborators/:collaborationId
```

**Auth:** Required

**Permissions:** Owner or ADMIN

**Body:**
```json
{
  "role": "ADMIN"
}
```

**Response (200):**
```json
{
  "message": "Collaborator role updated successfully",
  "collaboration": {
    "id": "collab-uuid",
    "role": "ADMIN"
  }
}
```

**Side Effects:** Broadcasts `permission-changed` Socket.IO event → affected user's page reloads

---

#### Remove Collaborator

```http
DELETE /api/canvases/:canvasId/collaborators/:userId
```

**Auth:** Required

**Permissions:** Owner or ADMIN

**Response (200):**
```json
{
  "message": "Collaborator removed successfully"
}
```

**Side Effects:**
- Broadcasts `access-revoked` Socket.IO event → kicked user redirects to gallery
- Broadcasts `collaborators-changed` to remaining users

---

#### Enable/Disable Share Link

```http
PATCH /api/canvases/:id/share-link
```

**Auth:** Required

**Permissions:** Owner only

**Body:**
```json
{
  "enabled": true,
  "shareRole": "EDITOR"
}
```

**Response (200):**
```json
{
  "message": "Share link updated",
  "shareToken": "token-uuid",
  "shareLink": "http://localhost:5173/canvas/canvas-uuid?inviteToken=token-uuid"
}
```

---

#### Rotate Share Token

```http
POST /api/canvases/:id/rotate-token
```

**Auth:** Required

**Permissions:** Owner only

**Response (200):**
```json
{
  "message": "Share token rotated successfully",
  "shareToken": "new-token-uuid",
  "shareLink": "http://localhost:5173/canvas/canvas-uuid?inviteToken=new-token-uuid"
}
```

**Side Effects:**
- Old token invalidated immediately
- Broadcasts `share-token-rotated` → anonymous users with old token get kicked

---

### User Profile

#### Update Display Name

```http
PUT /api/users/profile/name
```

**Auth:** Required

**Body:**
```json
{
  "displayName": "New Display Name"
}
```

**Validation:** 1-50 chars

**Response (200):**
```json
{
  "message": "Display name updated successfully",
  "user": {
    "displayName": "New Display Name"
  }
}
```

---

#### Change Password

```http
PUT /api/users/password
```

**Auth:** Required

**Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Validation:**
- Current password must match
- New password min 6 chars

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

**Rate Limited:** 3 attempts per hour

---

#### Upload Avatar

```http
POST /api/users/profile/avatar
```

**Auth:** Required

**Body:**
```json
{
  "avatarData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Validation:**
- Must be base64 data URL
- Formats: JPEG, PNG, GIF, WebP (SVG blocked for XSS prevention)
- Max size: 15MB
- Max dimensions: 10000×10000

**Processing:**
- Resize to 200×200 (cover fit)
- Convert to WebP quality 80
- Strip EXIF metadata
- 10s timeout

**Response (200):**
```json
{
  "message": "Avatar uploaded successfully",
  "user": {
    "avatarUrl": "data:image/webp;base64,..."
  }
}
```

**Rate Limited:** 10 uploads per hour

**File:** `server/controllers/userController.js:103-196` for security details

---

#### Delete Avatar

```http
DELETE /api/users/profile/avatar
```

**Auth:** Required

**Response (200):**
```json
{
  "message": "Avatar deleted successfully"
}
```

**Sets `avatarUrl` to `null`**

---

## Error Handling

**Common Errors:**

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "You do not have permission to access this canvas"
}
```

**404 Not Found:**
```json
{
  "error": "Canvas not found"
}
```

**429 Rate Limited:**
```json
{
  "error": "Too many requests, please try again later"
}
```

**500 Server Error:**
```json
{
  "error": "Internal server error",
  "details": "Sanitized error message (no stack traces in production)"
}
```

---

## Security Considerations

**What's Protected:**
- All passwords hashed with bcrypt (10 rounds)
- JWT tokens in httpOnly cookies (XSS-safe)
- Rate limiting on auth/upload endpoints
- Input validation on all endpoints
- Prisma ORM prevents SQL injection
- Avatar processing validates file type, strips metadata
- SVG upload blocked (XSS risk)
- ReDoS prevention in regex patterns

**What's NOT Protected (TODO):**
- No CSRF tokens (should add for state-changing requests)
- No Content Security Policy headers
- No DDoS protection at infrastructure level (just app-level rate limits)

---

## Testing with curl

**Register + Login:**
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

# Login (save cookie)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Use cookie for authenticated request
curl http://localhost:3001/api/auth/me \
  -b cookies.txt
```

**Create Canvas:**
```bash
curl -X POST http://localhost:3001/api/canvases \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Test Canvas","description":"From curl"}'
```

---

## Deployment Notes

**CORS Setup:**
```javascript
// server/index.js
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

**Environment Variables:**
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="generate-with-openssl-rand-hex-64"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="production"
CLIENT_URL="https://your-frontend.com"
```

**Cookie Security:**
- Development: `httpOnly: true, sameSite: 'lax'`
- Production: Add `secure: true` (requires HTTPS)

---

**Questions?** Check the actual controller code:
- `server/controllers/authController.js`
- `server/controllers/canvasController.js`
- `server/controllers/collaborationController.js`
- `server/controllers/userController.js`

The code is the ultimate source of truth.
