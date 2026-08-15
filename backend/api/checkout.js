// ONLY BAD OPTIONS — SumUp checkout (Vercel Serverless Function, Node 18+)
//
// Creates a SumUp Hosted Checkout for the cart and returns the URL the
// browser redirects to. Prices are taken from THIS file (server-authoritative)
// so a tampered client total can never change what is charged.
//
// Required environment variables (set in Vercel → Project → Settings → Env):
//   SUMUP_API_KEY        secret API key from SumUp (developer settings)
//   SUMUP_MERCHANT_CODE  your SumUp merchant code
//   SUCCESS_URL          (optional) page to return to after payment
//   ALLOW_ORIGIN         (optional) your site origin; default is the Pages site

const PRICES = {
  "shirt-easy":26, "shirt-dino":26, "vinyl-lp":36, "vinyl-ep":31, "cd":11,
  "schal":19, "cap":26, "poster-asl":6, "poster-luxor":6,
  "test-luis":1
};
const NOSHIP = new Set(["test-luis"]);   // items that don't ship (no DHL fee)

// Flat DHL shipping fees — keep in sync with cart.js
const SHIP = { de: 4.90, eu: 9.90 };
const EU = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);
function shipFee(c){ return c === "DE" ? SHIP.de : (EU.has(c) ? SHIP.eu : null); }

// Compact order description — carries the shipping address so it's visible on
// the SumUp transaction and recoverable via the webhook (no database needed).
function buildDescription(qty, c, country){
  let d = `OBO · ${qty} Artikel`;
  if (c && (c.firstName || c.lastName)) {
    const addr = [
      `${c.firstName||""} ${c.lastName||""}`.trim(),
      `${c.street||""}${c.zusatz ? " / " + c.zusatz : ""}`.trim(),
      `${c.plz||""} ${c.city||""}`.trim(),
      country
    ].filter(Boolean).join(", ");
    d += ` · Versand: ${addr}`;
    if (c.email) d += ` · ${c.email}`;
  }
  return d.slice(0, 250);
}

// Best-effort rate limit (per warm instance). Deters casual spam of the
// endpoint. For hard guarantees across instances use Upstash / Vercel KV.
const HITS = new Map();               // ip -> [timestamps]
const RL_MAX = 15, RL_WINDOW = 60000; // 15 requests / minute / IP
function rateLimited(ip){
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter(t => now - t < RL_WINDOW);
  arr.push(now); HITS.set(ip, arr);
  if (HITS.size > 5000) HITS.clear();
  return arr.length > RL_MAX;
}

export default async function handler(req, res){
  const origin = process.env.ALLOW_ORIGIN || "https://lonhuge.github.io";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "method not allowed" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too many requests" });

  try {
    const { items, shipping, customer } = req.body || {};
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "cart is empty" });

    const needsShipping = items.some(i => PRICES[i.id] && !NOSHIP.has(i.id));
    const country = String((shipping && shipping.country) || (customer && customer.country) || "").toUpperCase();
    let fee = 0;
    if (needsShipping) {
      fee = shipFee(country);
      if (fee === null) return res.status(400).json({ error: "we only ship to Germany and the EU" });
    }

    // recompute the amount from server-side prices — never trust the client.
    // sanitize quantities: positive integers only (blocks negative/fractional
    // qty from lowering the charge) and cap per line to stop abuse.
    let amount = 0, qty = 0;
    for (const i of items) {
      const price = PRICES[i.id];
      const q = Math.floor(Number(i.qty));
      if (!price || !Number.isInteger(q) || q < 1 || q > 100) continue; // ignore invalid lines
      amount += price * q;
      qty += q;
    }
    if (qty === 0 || amount <= 0) return res.status(400).json({ error: "invalid cart" });
    amount += fee;   // flat DHL shipping

    const r = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SUMUP_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        checkout_reference: "obo-" + Date.now(),
        amount: Number(amount.toFixed(2)),
        currency: "EUR",
        merchant_code: process.env.SUMUP_MERCHANT_CODE,
        description: buildDescription(qty, customer, country),
        hosted_checkout: { enabled: true },
        redirect_url: process.env.SUCCESS_URL || "https://lonhuge.github.io/only-bad-options/",
        return_url: process.env.WEBHOOK_URL   // server-to-server payment webhook (optional)
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: "sumup error", detail: data });

    // cart.js redirects the browser to checkout_url
    return res.status(200).json({ checkout_url: data.hosted_checkout_url, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: "server error", detail: String(e) });
  }
}
