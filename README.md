# Spin the Wheel — Tournament Draw

A two-page web app: a **public wheel** where participants submit teams and spin, and a separate **admin panel** where the organiser can secretly set the draw order. The wheel always lands on the rigged result.

## Flow

1. **Organiser** creates a room → gets a Room Code (e.g. `WOLF-7842`).
2. **Organiser** shares the public URL: `yourdomain.com/room/WOLF-7842`.
3. **Participants** open the link and enter team names (one per line), then submit.
4. **Organiser** goes to `yourdomain.com/admin`, enters Room Code + password, and sees all teams.
5. **Organiser** drags teams into the desired draw order and clicks **Lock rig**.
6. On the **public page**, someone clicks **SPIN!** — the wheel spins ~5s and lands on the pre-arranged order.
7. The full draw (1st, 2nd, 3rd…) is shown.

## Tech stack

- **Next.js 14** (App Router)
- **Upstash Redis** for room state (24h TTL)
- **Tailwind CSS** for styling
- **@dnd-kit** for admin drag-and-drop
- Canvas for the wheel animation

## Setup

1. Clone and install:

   ```bash
   npm install
   ```

2. Copy env and set values:

   ```bash
   cp .env.example .env.local
   ```

   - `ADMIN_PASSWORD` — used to log in to `/admin` (e.g. `tournament2025`).
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — from [Upstash Console](https://console.upstash.com/).

3. Run locally:

   ```bash
   npm run dev
   ```

   - Home: http://localhost:3000  
   - Public room: http://localhost:3000/room/WOLF-7842 (after creating a room)  
   - Admin: http://localhost:3000/admin  

## Deploy to Vercel

### 1. Get Upstash Redis (if you don’t have it)

1. Go to [console.upstash.com](https://console.upstash.com/) and sign in.
2. Create a new Redis database (free tier is fine).
3. Open the database and copy **REST URL** and **REST Token**.

### 2. Deploy from the Vercel dashboard

1. Push your code to GitHub (create a repo, then `git init`, `git add .`, `git commit -m "Initial commit"`, `git remote add origin <url>`, `git push -u origin main`).
2. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
3. Click **Add New…** → **Project** and import your `spin_the_wheel` repo.
4. Leave **Framework Preset** as Next.js and **Root Directory** as `.`. Click **Deploy** (it will build; you’ll add env next).
5. After the first deploy, go to **Project** → **Settings** → **Environment Variables** and add:

   | Name | Value |
   |------|--------|
   | `ADMIN_PASSWORD` | Your admin password (e.g. `tournament2025`) |
   | `UPSTASH_REDIS_REST_URL` | From Upstash (REST URL) |
   | `UPSTASH_REDIS_REST_TOKEN` | From Upstash (REST Token) |

   Add them for **Production** (and optionally Preview if you want).

6. Go to **Deployments**, open the **⋯** on the latest deployment, and click **Redeploy** so the build runs again with the env vars.

Your app will be at `https://your-project.vercel.app`. Create a room, share `/room/XXXX-XXXX`, and use `/admin` with the room code and `ADMIN_PASSWORD`.

### 3. Deploy from the CLI (alternative)

```bash
cd spin_the_wheel
npm install
npx vercel
```

Log in or sign up when prompted, then follow the prompts. After the first deploy, add the same environment variables in the Vercel dashboard (**Project** → **Settings** → **Environment Variables**), then run `npx vercel --prod` to deploy to production with env vars.

## Data model (per room)

- `roomCode` — e.g. `WOLF-7842`
- `teams` — submitted team names
- `riggedOrder` — desired draw order (set by admin)
- `status`: `waiting` → `teams_submitted` → `locked` → `spun`

Rooms expire 24 hours after creation.

## Security

- Admin password is checked **only on the server** (never sent to the client except on login).
- Admin session is stored in an HttpOnly cookie after login.
- No tokens or admin hints appear on the public room URL.
