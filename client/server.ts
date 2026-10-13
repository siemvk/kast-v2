const PORT = Number(process.env.PORT) || 5173;
const API_URL = process.env.API_URL || "http://localhost:3000";

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Proxy API requests to backend
    if (url.pathname.startsWith("/api/")) {
      try {
        return await fetch(`${API_URL}${url.pathname}${url.search}`, req);
      } catch {
        return new Response(JSON.stringify({ error: "Backend API offline or unreachable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 2. On-the-fly bundle TypeScript entry point
    if (url.pathname === "/app.js" || url.pathname === "/app.ts") {
      const build = await Bun.build({
        entrypoints: ["./client/app.ts"],
        target: "browser",
        sourcemap: "inline",
      });

      if (!build.success || !build.outputs[0]) {
        console.error("bun build failed:", build.logs);
        return new Response("console.error('Client build failed');", {
          status: 500,
          headers: { "Content-Type": "application/javascript" },
        });
      }

      return new Response(build.outputs[0]);
    }

    // 3. Serve static file if exists
    const file = Bun.file(`./client${url.pathname}`);
    if (await file.exists() && url.pathname !== "/") {
      return new Response(file);
    }

    // 4. SPA Fallback: all routes serve index.html
    return new Response(Bun.file("./client/index.html"));
  },
});

console.log(`Frontend SPA server running at http://localhost:${server.port}`);
