# Deploying to Render

Both the backend (Django API) and frontend (Vite static build) deploy from this one
repo using [`render.yaml`](../render.yaml). You do this once; after that, every
`git push` to `main` redeploys automatically.

> **Why two manual values?** The frontend needs the backend's URL, and the backend
> needs the frontend's URL (for security/CORS). Neither URL exists until the services
> are created — so you create them first, then paste the two URLs in. That's the only
> fiddly part, and it takes about two minutes.

---

## One-time setup

### 1. Push this repo to GitHub
Already done — it's at `github.com/Maham-Anwaar/truck-routing`.

### 2. Create the services from the blueprint
1. Go to **[dashboard.render.com](https://dashboard.render.com)** and sign up (free;
   you can sign in with GitHub).
2. Click **New → Blueprint**.
3. Connect your GitHub and pick the **truck-routing** repo.
4. Render reads `render.yaml` and shows **two services**: `truck-routing-api` and
   `truck-routing-web`. Click **Apply**.
5. It will ask you for the two `sync: false` values. You don't know the URLs yet —
   **put a placeholder** (or leave blank) for now and continue. We fix them in step 4.

Render now builds both. The backend takes a few minutes the first time.

### 3. Note the two URLs
Once they finish, each service has a public URL on its page, like:
- Backend: `https://truck-routing-api.onrender.com`
- Frontend: `https://truck-routing-web.onrender.com`

(Yours may have a random suffix if the name was taken — use whatever Render shows.)

### 4. Paste the URLs into each service, then redeploy
This is the step that makes them talk to each other.

**On the backend service** (`truck-routing-api` → **Environment**):
| Key | Value |
| --- | --- |
| `CORS_ALLOWED_ORIGINS` | the **frontend** URL, e.g. `https://truck-routing-web.onrender.com` |

**On the frontend service** (`truck-routing-web` → **Environment**):
| Key | Value |
| --- | --- |
| `VITE_API_URL` | the **backend** URL **+ `/api`**, e.g. `https://truck-routing-api.onrender.com/api` |

Save each — Render redeploys automatically. When both are green, open the frontend
URL. Done.

---

## Checking it works
- Backend health: open `https://<your-api>.onrender.com/api/health` → should return
  `{"status":"ok"}`.
- Frontend: open the frontend URL, click **Fill Example**, then **Plan**. If routes
  and weather appear, the two halves are talking.

---

## Gotchas
- **Free tier sleeps.** After ~15 min idle, the backend spins down; the first request
  after that takes ~30–60s to wake it. Fine for a demo — just load the page once a
  minute before you present.
- **`VITE_API_URL` is baked in at build time.** If you change the backend URL later,
  you must **redeploy the frontend** (changing the env var does this automatically).
- **Trailing slash:** the API has **no** trailing slashes, and `VITE_API_URL` should
  end in `/api` with **no** trailing slash.
- **Want real routing?** On the backend, set `ROUTING_PROVIDER=ors` and add
  `ORS_API_KEY=<your key>`. (Free ORS only returns 3 route options under ~100 km; long
  trips get one route — which is why synthetic is the default.)

---

## Alternative hosts
The app isn't tied to Render. The frontend is a static `dist/` folder (deploys to
Vercel, Netlify, Cloudflare Pages, GitHub Pages). The backend is a standard
gunicorn/WSGI service (deploys to Railway, Fly.io, or any VM). The only two settings
that ever change are the same two above: the frontend's `VITE_API_URL` and the
backend's `CORS_ALLOWED_ORIGINS`.
