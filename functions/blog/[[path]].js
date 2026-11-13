// Blog scheduling gate.
// Posts are committed as static pages under /blog/<slug>/ and listed in /blog/posts.json
// with a publish time ("at", UTC). This function hides a post until that time:
// it is removed from the blog front page and its own page answers 404.
// The pages themselves are written by the Daily Publisher app.

const notFound = () =>
  new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found — Drew Williams</title></head>' +
      '<body style="margin:0;font-family:Inter,Arial,Helvetica,sans-serif;color:#1a1a1a;text-align:center;padding:80px 20px">' +
      '<h1 style="font-size:28px;margin:0 0 12px">That page isn\u2019t here</h1><p style="margin:0"><a href="/blog/" style="color:#1a1a1a">Go to the blog</a></p></body></html>',
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["blog", slug?, ...]
  const now = Date.now();

  if (parts.includes("posts.json")) return notFound();

  if (parts.length <= 1) {
    const page = await env.ASSETS.fetch(request);
    const type = page.headers.get("Content-Type") || "";
    if (page.status !== 200 || !type.includes("text/html")) return page;
    let shown = 0;
    const filtered = new HTMLRewriter()
      .on("[data-at]", {
        element(el) {
          if (Date.parse(el.getAttribute("data-at")) > now) el.remove();
          else shown += 1;
        },
      })
      .on("[data-empty]", {
        element(el) {
          if (shown > 0) el.remove();
        },
      })
      .transform(page);
    const headers = new Headers(filtered.headers);
    headers.set("Cache-Control", "no-store");
    headers.delete("ETag");
    return new Response(filtered.body, { status: 200, headers });
  }

  let posts = [];
  try {
    const list = await env.ASSETS.fetch(new URL("/blog/posts.json", url));
    if (list.ok) posts = await list.json();
  } catch {
    posts = [];
  }
  // Only current, already-published posts are served. Anything else under /blog/ is not found,
  // so a removed post disappears immediately and a scheduled one stays hidden.
  const post = posts.find((p) => p.slug === parts[1]);
  if (!post || Date.parse(post.at) > now) return notFound();

  const page = await env.ASSETS.fetch(request);
  const headers = new Headers(page.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(page.body, { status: page.status, headers });
}
