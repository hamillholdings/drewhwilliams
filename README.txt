Drew Williams — personal website

Static site source plus a Cloudflare Pages Function for the contact form.
The public asset directory is the project root. No build command or dependencies are needed.

/directory/ is the social link directory.
/ forwards to /directory/ until a homepage is created.
The contact form requires name, phone number, email, message, and Cloudflare Turnstile.

Contact form setup
The public Turnstile site key is already set in directory/index.html. The Cloudflare
Workers Paid plan is active, and Email Sending is enabled for mail.drewhwilliams.com.

The Cloudflare Pages Production settings already have:
- CF_ACCOUNT_ID: the Cloudflare account ID
- CONTACT_TO: drewhamillwilliams@gmail.com
- CONTACT_FROM: contact@mail.drewhwilliams.com
- TURNSTILE_SECRET (secret): the Turnstile secret key

Before the contact form can send email, create a Cloudflare API token named
"drewhwilliams-contact-form" with only the account-level Email Sending: Edit permission
and a one-year expiration. Then add the token in the Pages project settings under
Settings → Variables and secrets → Production as a Secret named CF_EMAIL_API_TOKEN.
Save and deploy the Pages project after adding it. Never place the token in site files
or share it in chat.

The form handler is functions/api/contact.js. It validates the required fields,
checks the honeypot and Turnstile token server-side, then sends a plain-text email.
It does not store submissions or log their contents. The sender must use the configured
onboarded Email Sending domain. No recipient verification step is required for the REST API.
A static-only upload does not run functions/api/contact.js; connect the source to a
Cloudflare Pages Git project or deploy it with Wrangler Pages.
