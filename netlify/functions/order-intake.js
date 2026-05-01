const https = require("https");

exports.handler = async function(event, context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://finalverseco.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({error: "Method not allowed"}) };
  }

  let order;
  try {
    order = JSON.parse(event.body || "{}");
  } catch(e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({error: "Invalid JSON"}) };
  }

  const required = ["buyer_email", "deceased_name", "obituary", "song_style"];
  for (const field of required) {
    if (!order[field]) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({error: `Missing required field: ${field}`}) };
    }
  }

  const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN || "d687d25d-a157-4482-9eb4-4c5325d62a2d";

  const emailBody = `
NEW FINAL VERSE ORDER
=====================
Order ID:     ${order.order_id || "N/A"}
Timestamp:    ${order.timestamp || new Date().toISOString()}
Package:      ${order.package || "N/A"}
Status:       ${order.order_status || "intake_received_pending_payment"}
Payment:      ${order.payment_status || "pending"}

CUSTOMER
--------
Buyer Name:   ${order.buyer_name || "N/A"}
Email:        ${order.buyer_email}
Phone:        ${order.buyer_phone || "N/A"}

DECEASED
--------
Name:         ${order.deceased_name}
Nickname:     ${order.nickname || "none"}
Funeral Home: ${order.funeral_home || "N/A"}

SONG PREFERENCES
----------------
Style:        ${order.song_style}
Voice:        ${order.voice_preference || "N/A"}
Tone:         ${order.tone_preference || "N/A"}
Delivery:     ${order.delivery_option || "N/A"}
Consent:      ${order.consent_given || "N/A"}

OBITUARY / LIFE STORY
---------------------
${order.obituary}
`;

  const payload = JSON.stringify({
    From: "ceo@dortchai.com",
    To: "ceo@dortchai.com",
    Subject: `NEW ORDER ${order.order_id || ""} — ${order.deceased_name} [Final Verse]`,
    TextBody: emailBody,
    ReplyTo: order.buyer_email,
    Tag: "order-intake",
    TrackOpens: false,
  });

  try {
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.postmarkapp.com",
        path: "/email",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Postmark-Server-Token": POSTMARK_TOKEN,
          "Content-Length": Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          const result = JSON.parse(data);
          if (result.ErrorCode === 0) resolve(result);
          else reject(new Error(result.Message || "Postmark error"));
        });
      });
      req.on("error", reject);
      req.write(payload);
      req.end();
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, order_id: order.order_id }),
    };
  } catch(err) {
    console.error("Postmark error:", err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to save order. Please try again." }),
    };
  }
};
