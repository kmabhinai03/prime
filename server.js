const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const root = path.resolve(__dirname);

function readJSON(fname) {
  try {
    const p = path.join(root, fname);
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt);
  } catch (err) {
    return { error: `Failed to read ${fname}: ${err.message}` };
  }
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function handleSections(req, res) {
  const data = readJSON("sections.json");
  if (data && data.sections) return sendJSON(res, 200, data);
  return sendJSON(res, 500, {
    error: "Could not load sections.json",
    details: data,
  });
}

function findMovieByTitle(title) {
  const movies = readJSON("movieDetails.json");
  if (movies && movies.error)
    return { error: `Could not load movieDetails.json: ${movies.error}` };
  const q = String(title).trim().toLowerCase();

  // direct key
  if (movies[q]) return { key: q, movie: movies[q] };

  for (const [k, v] of Object.entries(movies)) {
    if (k.toLowerCase() === q) return { key: k, movie: v };
    if (v && v.title && String(v.title).toLowerCase() === q)
      return { key: k, movie: v };
  }

  const partials = [];
  for (const [k, v] of Object.entries(movies)) {
    if (
      k.toLowerCase().includes(q) ||
      (v && v.title && String(v.title).toLowerCase().includes(q))
    ) {
      partials.push({ key: k, movie: v });
    }
  }
  if (partials.length === 1) return partials[0];
  if (partials.length > 1) return { matches: partials };

  return null;
}

function handleMovie(req, res, queryTitle) {
  if (!queryTitle)
    return sendJSON(res, 400, {
      error: "Missing `title` (query or path param)",
    });
  const found = findMovieByTitle(queryTitle);
  if (found === null) return sendJSON(res, 404, { error: "Movie not found" });
  if (found && found.error) return sendJSON(res, 500, { error: found.error });
  return sendJSON(res, 200, found);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";

  if (pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Movie API: GET /sections and GET /movie?title=...");
  }

  if (pathname === "/sections" && req.method === "GET") {
    return handleSections(req, res);
  }

  if (pathname === "/movie" && req.method === "GET") {
    const title = parsed.query && parsed.query.title;
    return handleMovie(req, res, title);
  }

  // support /movie/:title
  if (pathname.startsWith("/movie/") && req.method === "GET") {
    const title = decodeURIComponent(pathname.replace("/movie/", ""));
    return handleMovie(req, res, title);
  }

  sendJSON(res, 404, { error: "Not found" });
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
