const http = require("http");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "bugs.json");
const PORT = process.env.PORT || 4000;

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 5e6) { req.destroy(); reject(new Error("too large")); }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error("bad json")); }
    });
  });
}

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === "GET" && p === "/bugs") {
    const db = readDB();
    const bugs = Object.values(db).sort((a, b) => b.created - a.created);
    return json(res, 200, bugs);
  }

  if (req.method === "POST" && p === "/bugs") {
    try {
      const bug = await parseBody(req);
      if (!bug.id || !bug.title) return json(res, 400, { error: "id and title required" });
      const db = readDB();
      db[bug.id] = bug;
      writeDB(db);
      return json(res, 201, bug);
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  if (req.method === "PUT" && p.startsWith("/bugs/")) {
    const id = p.slice(6);
    try {
      const update = await parseBody(req);
      const db = readDB();
      if (!db[id]) return json(res, 404, { error: "not found" });
      db[id] = { ...db[id], ...update, id };
      writeDB(db);
      return json(res, 200, db[id]);
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`bugs server on :${PORT}`));
