# AsMusic Web

React SPA for a music streaming player using [Navidrome](https://navidrome.org) (Subsonic-compatible API) as the backend.

## Setup

```bash
npm install
npm run dev
```

## API layer

We use [subsonic-api](https://github.com/explodingcamera/subsonic-api) (explodingcamera) for all Navidrome/Subsonic calls. The app wraps it in `src/api/`:

- **`createNavidromeApi(baseUrl, auth)`** — build an API instance (after login). Auth is `{ username, password }` or `{ apiKey }`.
- **`ping(baseUrl, auth)`** — check server and credentials.
- The returned `SubsonicAPI` instance supports all Subsonic 1.16.1 + OpenSubsonic methods: `getIndexes`, `getAlbum`, `getArtist`, `getPlaylists`, `getPlaylist`, `search2`, `search3`, `stream`, `getCoverArt`, etc.

## Project structure

```
src/
├── api/              # Thin wrapper around subsonic-api (explodingcamera)
│   ├── client.ts     # getApiBase(), createNavidromeApi()
│   ├── auth.ts       # ping()
│   └── index.ts
├── components/       # Reusable UI
│   └── Layout/       # App shell (sidebar + main + player bar)
├── features/         # Route-level pages
│   ├── home/
│   ├── library/      # Browse artists/albums
│   ├── playlists/
│   └── search/
├── hooks/            # useAuth, usePlayer, etc.
├── store/            # Global state (player, queue)
├── types/            # Navidrome/Subsonic types
├── utils/            # formatDuration, etc.
├── App.tsx
├── main.tsx
└── index.css
```

## Env

- `VITE_NAVIDROME_URL` — Navidrome server base URL (e.g. `https://music.example.com`). Defaults to `/api` (use Vite proxy in dev).

## Next steps

- Add auth flow (login form, store API instance in context) and protected routes.
- Implement player (audio element, queue, now-playing bar).
- Build library, playlists, and search UIs.
