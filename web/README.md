# Wayfund

(Formerly "Gap Year Hub".) One website for a gap year:

- **✨ Discover**: a feed of what travellers are up to, and events (**Stage 3, built**)
- **💬 Groups**: group chats anyone can join or leave (**Stage 2, built**)
- **🔒 My Trip**: private money and travel planning with personal tips (**Stage 1, built**)

Built with React + TypeScript + Vite, Tailwind CSS, Recharts and pdf.js.
Accounts use Supabase. It's a Progressive Web App (PWA), so it can be added to an
iPhone home screen and works offline.

## Look and feel

- **Name and logo:** Wayfund. The logo (`src/components/Logo.tsx`, `public/favicon.svg`, app icons in
  `public/`) is a sticker with a dotted path that turns into a £ sign.
- **Themes:** six colour themes (soft pastel Ocean, the default; Purple pop; Sunset; Earthy; plus deeper Navy and Charcoal), each
  with a dark version, picked in Profile → Appearance. All colours are variables in `src/index.css`:
  `brand` (pastel fill) and `brand-strong` (deeper shade for text), `coral` (accent), `sun` (warm),
  `cream` (tinted page), `surface` (cards). Charts read the same colours (`lib/useThemeColour.ts`).
- **Type:** Bricolage Grotesque for headings (bundled, works offline), system fonts for body text.
- **Playful touches:** floating background shapes, highlighter page titles, colour-filled cards, drawn
  icons (lucide) for navigation, emoji for categories, bouncy buttons and slide-in lists.
- **Charts** group the 26 categories into 8 (`trip/chartGroups.ts`: food and drink, getting around,
  places to stay, fun and shopping, essentials and admin, cash, bank fees, other), each with a fixed soft
  pastel so a group keeps its colour in every theme. Tapping a group opens its transactions.
- **Passport stamps** (`components/Stamp.tsx`): on the Route page, on finished checklist items, and a
  "Welcome to …" stamp when a new country on your route begins.
- **Confetti** (`lib/celebrate.ts`, `trip/components/Celebrations.tsx`): checklist finished, back on
  budget, first statement import, new country. All animation turns off if the device asks for reduced motion.

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

## My Trip: route, currencies and budgets (Stage 4a)

- **Route** (`/trip/route`): add countries with dates and a daily budget (in pounds). Drag the ≡
  handle, or use ▲ ▼, to reorder; "Fix dates to follow this order" moves dates to match.
  Spending is matched to a country by date. Each country shows actual £/day vs target
  (🟢 on budget, 🟠 up to 10% over, 🔴 more) and what to aim for to finish on budget.
- **Budgets** (`/trip/budgets`): a monthly limit per category (🟢 under 80%, 🟠 80–100%, 🔴 over).
- **+ Cash** (floating button on every My Trip page): type an amount, tap a category, done.
  The currency is guessed from where your route says you are. Once you log cash, ATM
  withdrawals stop counting as spending, so cash isn't counted twice.
- **Exchange rates** come from ExchangeRate-API's free service (all rates are downloaded at once,
  so it learns nothing about your plans), refresh every 12 hours, and are saved for offline use.
  Built-in backup rates in `src/trip/fx.ts` are used until the first download.
- The Dashboard adds a **Spend per country** chart and tips for the country you're in and your budgets.

| File | What's in it |
|---|---|
| `src/trip/route.ts` | Route and budget calculations (tested in `route.test.ts`) |
| `src/trip/fx.ts` | Exchange rates and currency formatting |
| `src/trip/countries.ts` | Countries with flags and currencies |
| `src/trip/pages/Route.tsx`, `Budgets.tsx` | The Route and Budgets screens |
| `src/trip/components/QuickAdd.tsx` | The + Cash button |

## My Trip: country cards and "Can I afford it?" (Stage 4b)

- **Countries** (`/trip/countries`): 25 country cards (Asia, Oceania, the Americas and Europe),
  your route's countries first. Each card: typical daily costs (backpacker and mid-range, in £ and
  local money), money tips, entry rules for UK passports, health, scams, plugs, emergency numbers,
  SIMs, and official links. European cards add Schengen 90/180, EES, ETIAS, GHIC and Interrail info.
- Researched from GOV.UK, TravelHealthPro and official visa sites on 12 Nov 2026 (key facts
  spot-checked). **Rules change**: cards show a "last checked" date, warn after 90 days, and can be
  edited in the app (edits are saved on the device, can be undone, and "Mark as checked today").
- **Can I afford it?** (`/trip/afford`): cost of N days in a country (backpacker, mid-range or your
  own £/day) against your spare money after your current route plan; can add it to your route.
- Adding a country to the route offers its typical costs as one-tap daily budgets, and the
  Dashboard warns if a country's budget is below typical costs or compares costs on your route.
- To update the built-in information, edit `src/trip/data/countries.json` (and its `lastChecked` dates).

## My Trip: more imports, lock, sync and dark mode (Stage 4c)

- **Imports:** CSV, PDF, **Excel (.xlsx)**, **OFX/QFX** and **QIF**. Old `.xls` files: save as .xlsx or CSV first.
  Excel sheets use the same column detection as CSV (`parsers/excel.ts`, `parsers/ofx.ts`, tested).
- **Lock** (My Trip → Settings): a 4–6 digit passcode, optional Face ID / Touch ID (WebAuthn passkey on
  the device), auto-lock after leaving the app. Only a PBKDF2 hash of the passcode is stored. Logging
  out removes the lock (so a forgotten passcode can be reset by logging in again). It's a privacy
  screen; it doesn't encrypt the data on the device.
- **Encrypted sync** (My Trip → Settings, signed-in accounts only): data is gzipped and encrypted with
  AES-256-GCM using a key derived on the device from the user's passphrase (PBKDF2-SHA256, 600,000 rounds).
  Supabase's `trip_vaults` table holds only ciphertext (one row per user, row-level security).
  Copies are merged (new transactions from both, later edits win, deletions kept, duplicates removed;
  route/budgets/settings: most recently changed wins). Syncs on open, ~15 s after changes, and on leaving
  the app; a version number stops two devices overwriting each other. **A forgotten passphrase can't be
  recovered**; each device keeps its own copy.
- **Dark mode** (Profile → Appearance): Bright (default), Dark or Match device. Colours are theme
  variables in `src/index.css` (`bg-surface`, `text-ink`, …), redefined under `html.dark`.

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
  Events add a title, start time, place, price, an optional `https://` link.
  **Only verified businesses can post events** (to stop scams and unsafe events). The database
  enforces this: the `verified_businesses` table lists who's verified, and only you can edit it
  (in the Supabase dashboard). Event posts automatically show the business's verified name and a
  green tick. See `supabase/events_verified_businesses_only.sql`, which also has the one-line
  commands to verify or un-verify a business.
- **Admins** (the `admins` table, set only in the Supabase dashboard) get a 🛡️ Admin badge and an
  **Admin** page (Profile → Admin tools) with a **reports inbox** (remove the reported post or
  message, or dismiss the report) and a **verified businesses** list (find an account by name and
  verify it, or remove it). Admins can also post events as "Wayfund team" and remove any post or
  chat message. See `supabase/admin_role.sql`.
- Admins can also **suspend** an account (from a report, or a post's ⋯ menu), optionally removing
  everything they've posted. Suspended people can still log in and use My Trip, but the database
  stops them posting, messaging, liking, reporting, or creating/joining groups; they see a notice
  explaining why. Admins can't be suspended. Suspensions are listed (and lifted) on the Admin page.
  Admins can also **delete any group**, and Profile shows how many reports are waiting. Removing a
  reported chat message works without the admin being able to read private group chats.
  See `supabase/admin_suspensions.sql`.
- **Moderators** are appointed and removed by admins (Admin page → Moderators). They get a
  🧑‍⚖️ Moderator badge and a **Moderation** page with just the reports inbox: they can dismiss
  reports and remove posts and chat messages **that have been reported**. The database checks
  there's a report before removing anything. They can't suspend people, verify businesses, delete
  groups, post events or appoint anyone, and a suspended moderator loses these powers.
  See `supabase/moderators.sql`.
- **Demo views:** in the demo, the yellow bar has a **Viewing as** menu to see the app as a
  **Guest** (look only: can't post, like, message, join or report), a **Normal user**, a
  **Moderator** or an **Admin** (with made-up reports, moderators, suspensions and verified
  businesses, in `src/admin/demoAdmin.ts`), or **Logged out** (the welcome page). This only
  changes the demo; real accounts get their role from the database.
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
- **Stage 4a (done):** route with country budgets, multi-currency, cash quick-add, category budgets.
- **Stage 4b (done):** country info cards, "Can I afford it?", country comparison tips.
- **Stage 4c (done):** Excel/OFX/QIF import, encrypted sync between devices, passcode/Face ID lock, dark mode.
