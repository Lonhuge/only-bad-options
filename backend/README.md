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
5. **Deploy.** Vercel gives you a URL like `https://obo-checkout.vercel.app`.
   Your endpoint is then: `https://obo-checkout.vercel.app/api/checkout`

## Point the site at it
In **`cart.js`** set:
```js
const CHECKOUT_URL = "https://obo-checkout.vercel.app/api/checkout";
```
Commit + push — the "zur kasse · SumUp" button now creates a real checkout and
redirects the customer to SumUp's secure payment page.

## Notes
- Prices are defined **inside `checkout.js`** (server-side), so a tampered
  client cart total can never change what's actually charged. Keep them in sync
  with `cart.js` / `product.html`.
- Same function works on **Netlify** or **Cloudflare Workers** with minor tweaks
  (request/response objects differ) — ask if you'd rather use one of those.
- Test with SumUp's sandbox credentials first if you have them.
