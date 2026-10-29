import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const port = Number(process.env.PORT || 3000);
const baseUrl = process.env.BASE_URL?.trim().replace(/\/+$/, "")
  || (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const publicRoot = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null;
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const links = new Map();

function makeCode() {
  let code = "";
  const bytes = new Uint8Array(16);

  while (code.length < 6) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 248) code += alphabet[byte % alphabet.length];
      if (code.length === 6) break;
    }
  }

  return code;
}

function response(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(body, { ...init, headers });
}

async function findPublicFile(pathname) {
  if (!publicRoot) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = resolve(publicRoot, relativePath);
  const fromRoot = relative(publicRoot, filePath);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;

  try {
    if ((await stat(filePath)).isFile()) return Bun.file(filePath);
  } catch {
    return null;
  }

  return null;
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return response(null, { status: 204 });

    if (request.method === "POST" && url.pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      if (typeof body?.url !== "string") {
        return response(JSON.stringify({ error: "A valid http(s) URL is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      let target;
      try {
        target = new URL(body.url);
      } catch {
        return response(JSON.stringify({ error: "A valid http(s) URL is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      if (target.protocol !== "http:" && target.protocol !== "https:") {
        return response(JSON.stringify({ error: "A valid http(s) URL is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      let code;
      do {
        code = makeCode();
      } while (links.has(code));

      const link = {
        code,
        url: target.href,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return response(JSON.stringify(link), {
        status: 201,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (request.method === "GET" && url.pathname === "/api/links") {
      return response(JSON.stringify([...links.values()]), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (request.method === "GET") {
      const file = await findPublicFile(url.pathname);
      if (file) return response(file);

      const match = url.pathname.match(/^\/([^/]+)$/);
      if (match) {
        let code;
        try {
          code = decodeURIComponent(match[1]);
        } catch {
          return response("Not found", { status: 404 });
        }

        const link = links.get(code);
        if (!link) return response("Not found", { status: 404 });
        link.hits += 1;
        return response(null, { status: 302, headers: { Location: link.url } });
      }
    }

    return response("Not found", { status: 404 });
  },
});

console.log(`Snip backend listening on ${baseUrl}`);