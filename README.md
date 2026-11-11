# JobRadar PK

One place for **every job in Pakistan and international remote work** — government commissions, private companies, UN/NGOs, remote job boards and Reddit hiring posts — with **deadlines**, **CV-based matching** and **email reminders** before applications close.

- **Frontend:** Next.js 15 + Tailwind CSS v4 → deploy on **Vercel**
- **Backend:** Node.js (Express) + PostgreSQL → deploy on **Railway**

## Features

| | |
|---|---|
| 🔎 **Search everything** | Full-text search across all sources, filters for type (Government / Private & NGO / Remote / Reddit gigs), Pakistan vs international, remote-only, deadline window and source |
| 📅 **Deadlines timeline** | Every job with a known closing date, grouped by day (Today, Tomorrow, Friday…) with urgency colours |
| 📄 **CV matching** | Upload PDF/DOCX/TXT → skills, job titles and years of experience are extracted. Every job gets a 0–100 match score with the skills you have ✓ and the ones you're missing |
| ⏰ **Reminders** | Daily email (≈9 AM PKT) with saved + matching jobs closing within 3 days, and new strong matches. Never repeats the same job |
| 📋 **Application tracker** | Save jobs, move them through To apply → Applied → Interview → Offer, and subscribe to a calendar (.ics) feed of your deadlines with 2-day alarms |
| 📱 **Responsive** | Works on phones; filters open as a bottom sheet |

## Accounts, Pro plan & admin

- **Free:** browse/search all jobs, deadlines, save jobs, saved-job deadline reminders.
- **Pro (Rs 1,000 / 30 days by default):** CV upload & matching, CV-based LinkedIn/Indeed searches, AI fit check & cover letters, match alert emails.
- **Payment:** user sends money to the Easypaisa/JazzCash number shown on `/billing`, then submits the Transaction ID + sender number + screenshot. The admin gets an email (with the screenshot attached), verifies the TID in their wallet app and approves in **Admin → Payments**. Approval adds the plan days and emails the user. Each TID can only be used once.
- **Admin panel (`/admin`):** overview, payment review, users (make free, add days, suspend, make admin, delete), settings (free-for-everyone switch, price, days, payment accounts, AI provider/key/model, Resend email), jobs data, audit log of every admin action.
- **Sign-in:** email + password, or Google via Firebase Authentication.

## Job sources

| Source | Covers | Key needed? | Deadlines |
|---|---|---|---|
| **Pakistan govt scraper** (`pkgov`) | FPSC, PPSC, KPPSC, SPSC, BPSC, NTS, PTS, OTS, ETEA, National Job Portal, newspaper ads via Jobz.pk | No | Parsed from "Last date…" text / table columns |
| **JSearch / Google Jobs** (`jsearch`) | LinkedIn, Indeed, Rozee.pk, Glassdoor, company sites. **Searches are built from each user's CV** (job titles × preferred locations, plus remote if wanted) and run right after a CV upload | RapidAPI key; spending capped by `JSEARCH_MONTHLY_CREDITS` | When the listing has one |
| **ReliefWeb** (`reliefweb`) | UN agencies, INGOs, NGOs in Pakistan (+ home-based) | Free appname | ✅ Real closing dates |
| **Remotive, Remote OK, Arbeitnow, Jobicy, Himalayas** | International remote jobs | No | Himalayas has real expiry dates; others parsed from text |
| **We Work Remotely + any RSS** (`rss`) | Remote jobs; add more feeds with `RSS_FEEDS` | No | Parsed from text |
| **Reddit** (`reddit`) | r/forhire, r/hiring, r/remotejs, r/jobbit, r/freelance_forhire, r/PakistanJobs, plus hiring posts in r/pakistan, r/Islamabad, r/karachi, r/lahore | Reddit app (free) — strongly recommended | Parsed from text |

Ingestion runs **every 3 hours**; expired jobs are cleaned up automatically (saved ones are kept).

### Things to know before going live

1. **Government sites change layout often.** The `pkgov` scraper doesn't rely on fixed CSS selectors — it reads each listing page's rows and pulls the title, link and closing date — but a site can still move its listing page. Check `GET /api/sources` after deploy: any site returning 0 rows needs its URL updated in `backend/src/sources/pk-sites.json` (or a `selector` added to narrow the area). The scraper respects `robots.txt` and waits between requests.
2. **Rozee.pk, LinkedIn and Indeed are not scraped directly** — their terms forbid it, and they block scrapers. JSearch (Google Jobs) is the legitimate way to get those listings. Add a RapidAPI key; without it private-sector Pakistan coverage is thin.
3. **Reddit blocks most anonymous traffic from cloud servers.** Create a free "script" app at <https://www.reddit.com/prefs/apps> and set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`.
4. Remote boards ask for attribution — the UI shows "via <source>" on every card; keep it.
5. Many remote jobs have no deadline — they show "Open until filled" and are not in the Deadlines page.

## Run locally

```bash
# 1. Database
docker run -d --name jr-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jobradar -p 5432:5432 postgres:16

# 2. Backend
cd backend
cp .env.example .env        # fill in what you have
npm install
npm test                    # deadline parser, skill extraction, matcher, govt scraper
npm run dev                 # http://localhost:4000 — creates tables and starts ingesting

# 3. Frontend
cd ../frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:3000
```

## Deploy

### Backend → Railway
1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → set **Root Directory** to `backend`.
3. In the same project: **New → Database → PostgreSQL**.
4. Backend service → **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET`, `ADMIN_KEY` = long random strings (`openssl rand -hex 32`)
   - `FRONTEND_URL` = your Vercel URL, e.g. `https://jobradar.vercel.app`
   - Source keys (`RAPIDAPI_KEY`, `RELIEFWEB_APPNAME`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`) and SMTP settings — see `backend/.env.example`
5. **Settings → Networking → Generate Domain**. `https://<domain>/health` should return `{"ok":true}`.
6. Trigger the first import now instead of waiting: `curl -X POST https://<domain>/api/admin/ingest -H "x-admin-key: <ADMIN_KEY>"`

### Frontend → Vercel
1. Vercel → **Add New Project** → import the repo → **Root Directory** `frontend`.
2. Environment variable `NEXT_PUBLIC_API_URL` = your Railway URL (no trailing slash).
3. Deploy, then make sure `FRONTEND_URL` on Railway matches the final Vercel domain.

### Email
Any SMTP works. Easiest options: **Gmail** (`smtp.gmail.com`, port 587, with an App Password), **Brevo** (300 free emails/day) or **Resend** (SMTP on `smtp.resend.com`). Without SMTP the app still works; reminders are just logged. Test with `curl -X POST https://<domain>/api/admin/reminders -H "x-admin-key: <ADMIN_KEY>"`.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/jobs?q=&category=&country=PK\|INTL&remote=true&deadline=7\|has&source=&sort=newest\|deadline\|relevance&page=` | Search (adds match scores when signed in) |
| GET | `/api/jobs/:id` · `/api/jobs/stats` · `/api/deadlines?days=14` · `/api/sources` | |
| POST | `/api/auth/register` · `/api/auth/login` | Returns JWT |
| GET/PATCH/DELETE | `/api/auth/me` | Profile, skills, preferences, alerts |
| POST | `/api/me/cv` (multipart `cv`) | Parse CV → profile |
| GET | `/api/me/matches?category=&remote=&closing=14` | Ranked matches |
| GET/POST/PATCH/DELETE | `/api/me/saved[/:jobId]` | Tracker |
| GET | `/api/me/saved/calendar.ics?token=` | Calendar feed |
| POST | `/api/admin/ingest` · `/api/admin/reminders` | Header `x-admin-key` |
| GET | `/api/admin/searches` | CV-based JSearch searches queued + credits used this month (header `x-admin-key`) |

## Extending
- **Add a govt/company site:** append to `backend/src/sources/pk-sites.json` (`id`, `org`, `location`, `url`, `category`).
- **Add a new API source:** create a file in `backend/src/sources/` exporting `{ name, label, fetch() }` returning normalized jobs, then add it to `sources/index.js`.
- **Smarter CV parsing:** set `ANTHROPIC_API_KEY` — skills and titles are extracted by Claude, falling back to the built-in dictionary (`src/lib/skills.js`) if the call fails.
- **Ideas for v2:** WhatsApp alerts (Meta Cloud API), Urdu UI, AI-written cover letters per job, Google sign-in.
