# LiveZone

Mobile sports scores, built with Expo and React Native. Open the Expo web preview at http://localhost:8081. The same app runs in Expo Go on a phone.

The scoreboard calls Expo route handlers on that same dev server (`/api/fixtures` and `/api/live`). Those handlers call [API-Sports](https://api-sports.io/) (API-Football), cache the result, and share one upstream fetch across clients. The API key is never shipped in the client bundle.

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
