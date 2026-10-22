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
- `GET /api/live?sport=basketball` — matches in progress for that sport.

`sport=all` asks each sport's API. Each product has its own free-plan quota, so the All filter costs one cached request per sport.

Live responses are cached for 25 seconds. Fixture responses are cached for 60 seconds. The scoreboard polls the active endpoint every 30 seconds while the app is open.

## Free-plan quota

The API-Sports free plan is about 100 requests per day. Caching collapses concurrent clients into one upstream fetch per cache window, but a dev server left open all day can still spend the allowance. Stop Expo when you are finished. If the daily limit is hit and a previous response is still in memory, LiveZone serves that last slate.
