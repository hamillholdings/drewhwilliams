// Blog scheduling gate.
// Posts are committed as static pages under /blog/<slug>/ and listed in /blog/posts.json
// with a publish time ("at", UTC). This function hides a post until that time:
// it is removed from the blog front page and its own page answers 404.
// The pages themselves are written by the Daily Publisher app.

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

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
  const post = posts.find((p) => p.slug === parts[1]);
  if (post && Date.parse(post.at) > now) return notFound();

  const page = await env.ASSETS.fetch(request);
  if (!post) return page;
  const headers = new Headers(page.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(page.body, { status: page.status, headers });
}
