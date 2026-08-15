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
  "schal":19, "cap":26, "poster-asl":6, "poster-luxor":6
};

export default async function handler(req, res){
  const origin = process.env.ALLOW_ORIGIN || "https://lonhuge.github.io";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "method not allowed" });

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "cart is empty" });

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
        description: `ONLY BAD OPTIONS — ${qty} Artikel`,
        hosted_checkout: { enabled: true },
        redirect_url: process.env.SUCCESS_URL || "https://lonhuge.github.io/only-bad-options/"
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
