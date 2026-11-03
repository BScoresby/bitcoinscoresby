function acceptsMarkdown(header) {
  return header.split(",").some((part) => {
    const [type, ...parameters] = part.trim().split(";");
    if (type.trim().toLowerCase() !== "text/markdown") return false;
    const quality = parameters
      .map((p) => p.trim().toLowerCase())
      .find((p) => p.startsWith("q="));
    return !quality || Number(quality.slice(2)) > 0;
  });
}

function varyByAccept(headers) {
  const current = headers.get("Vary");
  if (current === "*") return;
  const fields = (current || "").split(",").map((s) => s.trim().toLowerCase());
  if (!fields.includes("accept")) {
    headers.set("Vary", current ? `${current}, Accept` : "Accept");
  }
}

export async function onRequest({ request, env, next }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return next();
  }

  const pathname = new URL(request.url).pathname;
  // Defense in depth: no conversion for API, the payment-gated inbox,
  // the homepage terminal, or requests for files.
  if (
    pathname === "/" ||
    pathname === "/contact" || pathname.startsWith("/contact/") ||
    pathname === "/api" || pathname.startsWith("/api/") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return next();
  }

  if (acceptsMarkdown(request.headers.get("Accept") || "")) {
    const path = pathname.replace(/\/+$/, "") + "/index.md";
    const assetUrl = new URL(path, request.url);
    const asset = await env.ASSETS.fetch(new Request(assetUrl, {
      method: request.method,
    }));

    if (asset.ok) {
      const headers = new Headers(asset.headers);
      headers.set("Content-Type", "text/markdown; charset=utf-8");
      headers.delete("Content-Disposition");
      varyByAccept(headers);
      return new Response(request.method === "HEAD" ? null : asset.body, {
        status: asset.status,
        statusText: asset.statusText,
        headers,
      });
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  varyByAccept(headers);
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
