# Snip backend

A dependency-free Bun server for the Snip URL shortener. Links are stored in memory and are cleared when the server restarts.

## Run

Install Bun 1.x, then run:

```sh
bun start
```

The server listens on port `3000` by default. Configure `PORT` to change it, `BASE_URL` to set the origin used in returned short links, or `RAILWAY_PUBLIC_DOMAIN` to use `https://<domain>` when `BASE_URL` is unset. `BASE_URL` otherwise defaults to `http://localhost:<PORT>`.

Set `PUBLIC_DIR` to serve static files from a directory; `/` serves `index.html`. Existing files take precedence over short codes.

## API

- `POST /api/links` with `{ "url": "https://example.com" }` creates a short link.
- `GET /api/links` lists all links.
- `GET /:code` redirects to the original URL and increments its hit count.