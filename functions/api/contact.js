const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const clean = (value, maxLength) => String(value ?? "").trim().slice(0, maxLength);

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ success: false, message: "Request could not be verified." }, 403);
  }

  const form = await request.formData();
  if (clean(form.get("website"), 200)) {
    // Silently accept the honeypot so basic bots do not learn the field is monitored.
    return json({ success: true });
  }

  const name = clean(form.get("name"), 100);
  const phone = clean(form.get("phone"), 40);
  const email = clean(form.get("email"), 254);
  const message = clean(form.get("message"), 5000);
  const token = clean(form.get("cf-turnstile-response"), 2048);

  if (!name || !phone || !email || !message || !token) {
    return json({ success: false, message: "Please complete every field and the verification." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, message: "Please enter a valid email address." }, 400);
  }
  if (!/^[+0-9().\-\s]{7,40}$/.test(phone)) {
    return json({ success: false, message: "Please enter a valid phone number." }, 400);
  }

  if (!env.TURNSTILE_SECRET || !env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN || !env.CONTACT_TO || !env.CONTACT_FROM) {
    return json({ success: false, message: "The contact form is not configured yet." }, 503);
  }

  const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") ?? "",
    }),
  });
  const verified = await verification.json();
  if (!verified.success || verified.action !== "contact" || verified.hostname !== new URL(request.url).hostname) {
    return json({ success: false, message: "Verification failed. Please try again." }, 400);
  }

  const subjectName = name.replace(/[\r\n]+/g, " ").slice(0, 100);
  const emailResult = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/email/sending/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      reply_to: email,
      subject: `Website contact from ${subjectName}`,
      text: `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\n\nMessage:\n${message}`,
    }),
  });
  const result = await emailResult.json();
  if (!emailResult.ok || !result.success) {
    return json({ success: false, message: "The message could not be sent. Please try again later." }, 502);
  }

  return json({ success: true });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestPost(context);
}
