# LiveZone

Mobile sports scores, built with Expo and React Native. Open the Expo web preview at http://localhost:8081. The same app runs in Expo Go on a phone.

**Live:** https://livezone.vercel.app

The scoreboard calls Expo route handlers on that same origin (`/api/fixtures` and `/api/live`). Those handlers call [API-Sports](https://api-sports.io/) (API-Football), cache the result, and share one upstream fetch across clients. The API key is never shipped in the client bundle.

Favorites (games + teams) and preferred sport/tier settings are stored locally with AsyncStorage. Star a match or team on the scoreboard; open **Favorites** / **Settings** from the header.

## Design system

Night-stadium navy base with electric lime accents. Energy cues from ESPN red/gold (`#FF2E4D` siren, `#F5B50C` gold) without purple glow. Tokens live in `lib/theme.ts`.

| Token | Hex | Role |
| --- | --- | --- |
| `--night` | `#07111F` | Screen background |
| `--pitch` | `#0D2137` | Controls / chip base |
| `--panel` | `#12283F` | Match cards / panels |
| `--lime` | `#B8F542` | LIVE accents, selected chips, brand ZONE |
| `--siren` | `#FF2E4D` | Errors / remove actions |
| `--gold` | `#F5B50C` | Demo badge, favorite stars, favorites accent |
| `--mist` | `#9BB0C7` | Secondary labels |
| `--paper` | `#E8F0FA` | Primary text |

**Typography:** Oswald (condensed scores + LIVEZONE wordmark) and Figtree (UI labels) via `@expo-google-fonts/*`, loaded in `app/_layout.tsx`.

**Motion (Animated API):** LIVE badge pulse, favorite star scale-on-press, filter chip selection spring. Favorites/settings brand LiveZone at the top with denser match cards and lime selected chips.

## Deploy to Vercel (no dev server)

1. Import the repo in Vercel (or use the linked `livezone` project).
2. Set server-side environment variables (do NOT prefix with `EXPO_PUBLIC_`):
   - `API_SPORTS_KEY` (required for live data)
   - `API_SPORTS_BASE_URL` (optional, football host override)
   - `API_SPORTS_DAILY_LIMIT` (optional, default 80)
   - `API_SPORTS_STRICT` (optional, set `1` to fail hard instead of demo fallback; alias `LIVEZONE_FAIL_HARD=1`)
3. Build uses `npx expo export -p web` → static client in `dist/client`, API routes in `dist/server`, served via `api/index.ts` (`expo-server` Vercel adapter). See `vercel.json`.

The client calls relative `/api/*` routes on the same origin, so no URL config is needed.

## Run

From this folder:

```bash
npx expo start --web
```

Then open http://localhost:8081.

`npx expo start` opens the Expo dev tools on the same port. Press `w` there to launch web. Do not use another port for this app.

Other targets from the same dev server:

```bash
npx expo start --android
npx expo start --ios
```

## API key

1. Register at [api-football.com](https://www.api-football.com/) and copy the API-Sports key.
2. Copy `.env.example` to `.env.local`.
3. Set `API_SPORTS_KEY` in `.env.local`.

`.env` and `.env.local` are gitignored. Do not put the key in an `EXPO_PUBLIC_` variable. Only the server route handlers read it. If the key is missing, the app shows a demo slate so the UI still runs.

`API_SPORTS_BASE_URL` overrides the football (soccer) host only. Basketball and American football use their own API-Sports hosts. The same key is sent only from the server.

## Endpoints

Served by the Expo dev server. Add `sport=all`, `sport=football`, `sport=basketball`, or `sport=american-football`. `all` is the default.

- `GET /api/fixtures?date=YYYY-MM-DD&sport=football` — games for that day. If `date` is omitted, the server uses its local calendar day.
- `GET /api/live?sport=basketball` — matches in progress for that sport. Football uses the API-Sports live feed. Basketball and American football do not support that parameter, so the server requests that day's games and keeps the ones in progress.

`sport=all` reads Football, Basketball, and American Football from separate caches. A poll refreshes at most one stale sport, so All does not fire three API-Sports calls at once. The other sports stay on their last cached scores. With an API key, a sport that has not been fetched yet is left out until a later poll, instead of being filled with demo games. Every upstream call counts toward the daily cap, including extra pages.

The scoreboard polls the local `/api/fixtures` or `/api/live` route every 30 seconds while the app is open. It never calls API-Sports itself.

Major, College, and Minor filter the games already on screen: Major is the NBA, the NFL, and top-flight soccer (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League, MLS); College is NCAA and similar; every other league, including ones LiveZone does not recognize, is Minor. Choosing a tier does not call API-Sports.

## Free-plan quota

The API-Sports free plan is about 100 requests per day. LiveZone keeps live responses for 30 seconds and fixtures for 60 seconds. A later poll in that window is served from memory and does not call API-Sports. Calls already in flight for the same sport, date, and endpoint are shared, so many phones polling together make one upstream request.

The server allows 80 API-Sports requests per UTC day by default. Set `API_SPORTS_DAILY_LIMIT` in `.env.local` to change that cap. When the cap is spent, or API-Sports returns HTTP 429, LiveZone does not retry. It returns the last cached scores, or the demo games if nothing is cached, with `rateLimited: true`. The scoreboard keeps showing those games and adds the note "Live data paused to protect the API quota". Stop Expo when you are finished so a dev server is not left polling.
