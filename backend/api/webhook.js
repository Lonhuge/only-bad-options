// ONLY BAD OPTIONS — SumUp payment webhook (Vercel Serverless Function)
//
// SumUp POSTs { event_type, id } here when a checkout's status changes.
// The payload is NOT signed, so we NEVER trust it directly — we re-fetch the
// checkout from SumUp's API with our secret key. That re-fetch is the auth:
// nobody can fake a "PAID" status because only SumUp (via our key) can report it.
//
// Env vars:
//   SUMUP_API_KEY         (required) same secret key as checkout.js
//   MERCHANT_NOTIFY_URL   (optional) a Discord/Slack incoming-webhook URL to
//                         ping you when an order is paid
//
// SumUp retries non-2xx responses (after 1m, 5m, 20m, 2h), so we return:
//   200 → handled or safely ignored   |   5xx → transient error, please retry

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { event_type, id } = req.body || {};
    // silently ignore anything we don't recognise (SumUp may add events)
    if (event_type !== "CHECKOUT_STATUS_CHANGED" || !id) return res.status(200).end();

    // verify with SumUp — authoritative source of truth
    const r = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(id)}`, {
      headers: { "Authorization": `Bearer ${process.env.SUMUP_API_KEY}` }
    });
    if (!r.ok) {
      console.error("checkout verify failed", id, r.status);
      return res.status(502).end();           // transient → let SumUp retry
    }
    const co = await r.json();

    if (co.status === "PAID") {
      const order = {
        ref: co.checkout_reference,
        amount: co.amount,
        currency: co.currency,
        id: co.id,
        at: new Date().toISOString()
      };
      console.log("✅ PAID ORDER", JSON.stringify(order));   // visible in Vercel logs
      await notify(order);
      // ↳ add your fulfillment here (save to DB / Google Sheet / send email)
    }
    // PENDING / FAILED / EXPIRED → nothing to do; SumUp will notify again on change

    return res.status(200).end();
  } catch (e) {
    console.error("webhook error", e);
    return res.status(500).end();             // transient → let SumUp retry
  }
}

// Optional: ping a Discord/Slack incoming webhook so you hear about orders.
async function notify(order) {
  const url = process.env.MERCHANT_NOTIFY_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "content" works for Discord; for Slack use { text: ... }
      body: JSON.stringify({
        content: `🛒 Neue Bestellung **${order.ref}** — ${order.amount} ${order.currency} bezahlt (${order.id}).`
      })
    });
  } catch (e) { console.error("notify failed", e); }
}
