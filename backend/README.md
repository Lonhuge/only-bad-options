# Checkout backend (SumUp) — deploy in ~5 minutes

The store frontend (on GitHub Pages) is static, so the actual card payment
runs through this tiny serverless function. It holds your **secret** SumUp key
(never in the browser), creates a SumUp **Hosted Checkout** for the cart total,
and returns the URL the customer is sent to.

## What you need from SumUp
1. A SumUp **merchant account**.
2. In the SumUp dashboard → **Developers / API keys**: create an **API key** → this is `SUMUP_API_KEY`.
3. Your **merchant code** (shown in the dashboard) → this is `SUMUP_MERCHANT_CODE`.

## Deploy on Vercel (recommended, free)
1. Go to <https://vercel.com> → sign in with GitHub → **Add New… → Project**.
2. Import the **`only-bad-options`** repo.
3. Set **Root Directory** to `backend`.
4. **Environment Variables** — add:
   - `SUMUP_API_KEY` = your secret key
   - `SUMUP_MERCHANT_CODE` = your merchant code
   - `SUCCESS_URL` = `https://lonhuge.github.io/only-bad-options/` (optional)
   - `ALLOW_ORIGIN` = `https://lonhuge.github.io` (optional)
   - `MERCHANT_NOTIFY_URL` = a Discord/Slack incoming-webhook URL (optional — get pinged on paid orders)
5. **Deploy.** Vercel gives you a URL like `https://obo-checkout.vercel.app`.
   - Checkout endpoint: `https://obo-checkout.vercel.app/api/checkout`
   - Webhook endpoint:  `https://obo-checkout.vercel.app/api/webhook`
6. **Enable the webhook:** add one more env var and redeploy:
   - `WEBHOOK_URL` = `https://obo-checkout.vercel.app/api/webhook`

   (Set it after the first deploy, once you know your domain, then redeploy.)

## Point the site at it
In **`cart.js`** set:
```js
const CHECKOUT_URL = "https://obo-checkout.vercel.app/api/checkout";
```
Commit + push — the "zur kasse · SumUp" button now creates a real checkout and
redirects the customer to SumUp's secure payment page.

## Order log + email (Google Sheet)
Every order is written to a Google Sheet you own, and you get an email the moment
it's paid — with the full item list and shipping address. Free, no third-party
service (sends from your own Google account).

1. Create a Google Sheet (e.g. "OBO Bestellungen").
2. In it: **Extensions → Apps Script**, delete the sample, and paste
   [`order-sheet.gs`](order-sheet.gs).
3. At the top of that script set **`NOTIFY_EMAIL`** (where order emails go) and
   **`SECRET`** (any random word).
4. **Deploy → New deployment → Web app** — *Execute as: Me*, *Who has access: Anyone* —
   and copy the `/exec` URL. (First run asks you to authorize sending email — allow it.)
5. In Vercel add env vars and **redeploy**:
   - `SHEET_URL`    = that `/exec` URL
   - `SHEET_SECRET` = the same `SECRET` you set in the script

Flow: `checkout.js` writes each order as **pending** at checkout; the webhook flips
it to **paid** and triggers the email once SumUp confirms payment. Abandoned
checkouts stay as `pending` rows — filter the Status column for `paid`.

## Payment confirmation (the "did they actually pay?" part)
- `checkout.js` passes `return_url = WEBHOOK_URL` when creating a checkout, so
  SumUp POSTs `api/webhook` whenever the checkout's status changes.
- `webhook.js` **never trusts the webhook body** — it re-fetches the checkout
  from SumUp's API with your key and only treats `status === "PAID"` as real.
  That re-fetch is the security (the payload is unsigned).
- Paid orders are logged in Vercel (**Deployments → Logs**) and, if
  `MERCHANT_NOTIFY_URL` is set, pushed to your Discord/Slack.
- **Trust the webhook / SumUp dashboard for fulfillment — not the browser
  redirect** (a redirect can be faked; a verified `PAID` status cannot).
- To store full line items per order, add a DB / Google Sheet in the marked
  spot in `webhook.js` (SumUp only stores the amount + reference, not your cart).

## Notes
- Prices are defined **inside `checkout.js`** (server-side), so a tampered
  client cart total can never change what's actually charged. Keep them in sync
  with `cart.js` / `product.html`.
- The checkout endpoint has **best-effort rate limiting** (15 req/min/IP per
  instance) to deter spam. For hard limits across instances, use Upstash or
  Vercel KV — ask and I'll wire it in.
- Same function works on **Netlify** or **Cloudflare Workers** with minor tweaks
  (request/response objects differ) — ask if you'd rather use one of those.
- Test with SumUp's sandbox credentials first if you have them.
