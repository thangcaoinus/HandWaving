# HandWaving

A real-time collaborative whiteboard that transforms hand-drawn gestures into clean geometric shapes.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)

---

## What It Does

- **Smart shape detection** - Automatically converts freehand drawings into circles, rectangles, triangles, and arrows
- **Real-time collaboration** - Multiple users drawing simultaneously with live cursors and presence
- **Canvas management** - Save, organize with tags, export to PNG/PDF/JSON
- **Share links** - Invite guests with role-based permissions (Viewer/Editor/Admin)
- **Text tool** - Add inline text with multiline support

---

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Socket.IO Client

**Backend:** Node.js, Express, Socket.IO, PostgreSQL, Prisma ORM

---

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp server/.env.example server/.env
# Edit server/.env with your DATABASE_URL and JWT_SECRET

# Run database migrations
cd server && npx prisma migrate dev && cd ..

# Start development servers
npm run dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:3001`.

---

## Documentation

For architecture details, development guides, and API reference, see the `/docs` folder.
