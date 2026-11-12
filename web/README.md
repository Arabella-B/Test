# Gap Year Hub

One website for a gap year:

- **✨ Discover**: a feed of what travellers are up to, and events (**Stage 3, built**)
- **💬 Groups**: group chats anyone can join or leave (**Stage 2, built**)
- **🔒 My Trip**: private money and travel planning with personal tips (**Stage 1, built**)

Built with React + TypeScript + Vite, Tailwind CSS, Recharts and pdf.js.
Accounts use Supabase. It's a Progressive Web App (PWA), so it can be added to an
iPhone home screen and works offline.

## Privacy: how My Trip data is kept private

- Bank statements are read **in the browser**. The file is never uploaded.
- Transactions, budgets, dates and the checklist are saved **only on that device**
  (IndexedDB). They are not sent to the website, Supabase or anyone else.
- Each account (and the demo) gets its own separate storage on the device.
- Supabase stores the account (email and password), a public display name, and
  group chats and Discover posts (with photos in a private storage bucket). It never stores My Trip data.
- **Never put real personal data (budgets, statements, travel plans) in this code
  or in the demo data.** The demo uses a made-up traveller called "Alex".

## Running it on your Mac

Node.js is installed in `~/.local/node`. In Terminal:

```bash
cd ~/Documents/test/web
export PATH="$HOME/.local/node/bin:$PATH"
npm install          # first time only
npm run dev          # opens on http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the automated tests (statement readers, categoriser, dates and money) |
| `npm run build` | Checks the code and builds the website into `dist/` |
| `npm run preview` | Serves the built website, to try the installable/offline version |

Settings for Supabase live in `.env.local` (not saved to GitHub):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Where things are

| Folder / file | What's in it |
|---|---|
| `src/trip/parsers/csv.ts` | Reads CSV statements, detects columns, UK dates |
| `src/trip/parsers/pdf.ts` | Reads PDF statements (Paid out / Paid in / Balance, multi-line rows) |
| `src/trip/merchants.ts` | The built-in merchant keyword list. **Add merchants here.** |
| `src/trip/categorise.ts` | Picks categories, spots foreign spending, fees, family and transfers |
| `src/trip/categories.ts` | The categories, with their colours and emoji |
| `src/trip/stats.ts` | Dashboard numbers: money left, runway, charts |
| `src/trip/insights.ts` | Personal tips |
| `src/trip/checklist.ts` | The pre-departure checklist |
| `src/trip/demo.ts` | Made-up demo data |
| `src/trip/db.ts` | On-device storage |
| `src/trip/pages/` | The My Trip screens |

## Groups: how they work

- Anyone signed in can see groups, create one, and join or leave freely.
- Only **members** can read or send a group's messages. People can only add or
  remove **themselves**. The group's creator can remove any message in it.
  These rules are enforced by the database itself (row-level security).
- New messages appear live (Supabase Realtime on the `messages_chat` table).
- Safety: tap a message to **report** it or **block** its author (blocked people's
  messages are hidden; unblock in Profile). Reports are stored in the `reports`
  table, which only the site owner can read in the Supabase dashboard.
- Anti-spam: at most 5 messages per person per 10 seconds, and 10 new groups per day.
- In the demo, groups are made up, kept in memory, and reset when you reload.

| File | What's in it |
|---|---|
| `src/groups/types.ts` | Shapes, and the list of report reasons |
| `src/groups/supabaseApi.ts` | The real groups service (Supabase) |
| `src/groups/demoApi.ts` | The pretend service for the demo |
| `src/groups/GroupsPage.tsx` | My groups / Find groups |
| `src/groups/GroupChat.tsx` | The chat screen, report and block |

**Checking reports:** Supabase dashboard → Table editor → `reports`.

## Discover: how it works

- A Pinterest-style grid of **updates** ("what I'm up to") and **events** (e.g. hostels,
  tour companies or travellers organising meet-ups). Filters: All, Updates, Upcoming
  events, and by country. Tap a post to see it full size; tap ❤️ to like.
- **Posting** (the ➕ tab): a photo or a coloured text card, caption, place and country.
  Events add a title, start time, place, price, an optional `https://` link and a business name.
- **Photos** are shrunk on the device (max 1600px JPEG) before upload. Re-drawing the photo
  also **removes hidden location (GPS) data**. They're stored in the private `post-images`
  bucket; the feed shows them using links that expire after an hour.
- Only signed-in users can see posts and photos. You can only post as yourself, upload
  into your own folder, and delete your own posts. Links must start with `https://`.
- Report or block from a post's ⋯ menu. Blocking hides someone's posts and messages.
- Anti-spam: at most 20 posts per person per day.

| File | What's in it |
|---|---|
| `src/discover/DiscoverPage.tsx` | The feed and filters |
| `src/discover/PostCard.tsx` | One tile in the grid |
| `src/discover/PostDetail.tsx` | A post full size, like, report, block, delete |
| `src/discover/NewPostPage.tsx` | The Post screen |
| `src/discover/supabaseApi.ts` / `demoApi.ts` | Real and pretend services |
| `src/lib/images.ts` | Shrinks photos and strips location data |
| `src/components/` | Shared pop-up and report form |

## Deploying (Render static site)

1. On Render: **New → Static Site**, and pick this GitHub repo.
2. **Root directory:** `web` · **Build command:** `npm install && npm run build` · **Publish directory:** `dist`
3. **Environment:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. **Redirects/Rewrites:** add a rewrite from `/*` to `/index.html`, so links like `/trip/import` work.
5. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to the Render address
   and add it (and `http://localhost:5173`) to **Redirect URLs**, so confirmation emails link back correctly.

## Installing on iPhone

Open the website in **Safari** → **Share** → **Add to Home Screen**. Open it from the
home-screen icon from then on: data stored by home-screen apps is kept by iOS, whereas
Safari may clear data for websites you haven't visited in a while. Back up regularly
(My Trip → Settings → Export backup) and keep the file in iCloud Drive.

## Plan

- **Stage 1 (done):** accounts, layout, My Trip: CSV/PDF import, automatic categories,
  transactions, dashboard and charts, runway, first tips, checklist, backups, demo.
- **Stage 2 (done):** Groups with live chat; reporting, blocking and anti-spam.
- **Stage 3 (done):** Discover feed with photos, events, likes, reporting and blocking.
- **Stage 4:** budgets per category/country, trips and multi-currency, cash quick-add,
  country info cards, "Can I afford it?", Excel/OFX import, optional sync between devices.
