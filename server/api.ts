import "dotenv/config";

import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getDashboardData } from "./dashboard";

const PORT = Number(process.env.PORT || process.env.API_PORT || "3001");
const ROOT_DIR = join(fileURLToPath(new URL("..", import.meta.url)));
const DIST_DIR = join(ROOT_DIR, "dist");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
  sendJson(res, statusCode, { error: message });
}

function getRequestPath(req: IncomingMessage) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  return decodeURIComponent(url.pathname);
}

async function handleApi(req: IncomingMessage, res: ServerResponse) {
  const path = getRequestPath(req);

  if (path === "/api/health") {
    sendJson(res, 200, { ok: true, generatedAt: new Date().toISOString() });
    return;
  }

  if (path === "/api/dashboard" || path === "/api/alerts") {
    try {
      const data = await getDashboardData();
      sendJson(res, 200, path === "/api/alerts" ? { alerts: data.alerts } : data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "שגיאת שרת לא ידועה";
      sendError(res, 500, message);
    }
    return;
  }

  sendError(res, 404, "API לא נמצא");
}

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  if (!existsSync(DIST_DIR)) {
    sendError(res, 404, "קבצי UI לא נמצאו. צריך להריץ npm run build.");
    return;
  }

  const path = getRequestPath(req);
  const requestedPath = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  const normalizedPath = normalize(requestedPath);
  const filePath = join(DIST_DIR, normalizedPath);

  if (!filePath.startsWith(DIST_DIR)) {
    sendError(res, 403, "נתיב לא חוקי");
    return;
  }

  const fallbackPath = join(DIST_DIR, "index.html");
  const targetPath = existsSync(filePath) ? filePath : fallbackPath;
  const contentType = CONTENT_TYPES[extname(targetPath)] ?? "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": targetPath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
  });
  createReadStream(targetPath).pipe(res);
}

export function startApiServer() {
  const server = createServer((req, res) => {
    const path = getRequestPath(req);

    if (path.startsWith("/api/")) {
      handleApi(req, res).catch((error) => {
        const message = error instanceof Error ? error.message : "שגיאת שרת לא ידועה";
        sendError(res, 500, message);
      });
      return;
    }

    serveStatic(req, res).catch((error) => {
      const message = error instanceof Error ? error.message : "שגיאת שרת לא ידועה";
      sendError(res, 500, message);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`שרת API/UI הופעל על פורט ${PORT}.`);
  });

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startApiServer();
}
