// ============================================
// KL BROTHER - WhatsApp Business API Server
// ============================================
// Stack: Node.js + Express + Meta WhatsApp Cloud API + Claude AI
// 
// SETUP STEPS:
// 1. npm install express axios dotenv
// 2. Create .env file with your credentials
// 3. node server.js
// ============================================

require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ============================================
// ENV VARIABLES (.env file mein daalo)
// ============================================
// WHATSAPP_TOKEN=your_meta_whatsapp_token
// WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
// VERIFY_TOKEN=klbrother_secret_token
// ANTHROPIC_API_KEY=your_claude_api_key
// PORT=3000

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "klbrother_secret_token";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

// ============================================
// CLAUDE AI - KL BROTHER SYSTEM PROMPT
// ============================================
const SYSTEM_PROMPT = `Tum ek friendly WhatsApp assistant ho jo "KL BROTHER" kapde ki wholesale dukaan ke liye kaam karte ho.

=== DUKAAN KI PURI JANKARI ===
🏪 Naam: KL BROTHER
📍 Pata: Bardahiya Bazaar, Khalilabad, Sant Kabir Nagar
📞 Phone: 8957898317
👥 Type: Wholesale Kapde Ki Dukaan (Bacho se lekar Bado tak)

=== PRODUCTS ===

👶 BABY & KIDS (0-12 saal):
- Baby rompers & onesies (0-12 months): ₹80-₹150/piece
- Kids T-shirts & tops (1-12 yr): ₹90-₹200/piece
- Kids Jeans & Pants: ₹150-₹350/piece
- Kids Frock & Dress (Girls): ₹120-₹400/piece
- School Uniform sets: ₹200-₹500/set
- Kids Ethnic wear (Kurta, Sherwani, Lehenga): ₹300-₹800/piece
- Kids Winter wear (Jacket, Sweater): ₹200-₹600/piece

👨 MEN:
- Men's T-shirts & Polos: ₹150-₹400/piece
- Men's Shirts (Casual & Formal): ₹200-₹600/piece
- Men's Jeans & Trousers: ₹300-₹900/piece
- Men's Kurta & Pyjama: ₹250-₹800/set
- Men's Jacket & Hoodie: ₹400-₹1200/piece

👩 WOMEN:
- Women's Kurtis & Tops: ₹150-₹600/piece
- Women's Saree: ₹400-₹2000/piece
- Salwar Suit (3 piece): ₹500-₹2500/set
- Women's Leggings & Palazzos: ₹100-₹300/piece
- Women's Winter wear: ₹400-₹1500/piece

=== WHOLESALE RULES ===
- Minimum order: 12 piece / 1 dozen (ek design mein)
- 50+ pieces: 10% extra discount
- 100+ pieces: 15% extra discount
- 500+ pieces: Special rate - owner se baat karein
- Monthly dealers ke liye: Special deal available

=== SIZES ===
- Baby: 0-3M, 3-6M, 6-12M
- Kids: 1yr se 12yr tak
- Adults: XS, S, M, L, XL, XXL, XXXL

=== DELIVERY ===
- Local (Khalilabad area): Same day / Next day
- Pan India shipping available
- Freight charge alag se (order ke hisaab se)

=== PAYMENT ===
- UPI / PhonePe / GPay: 8957898317
- Bank Transfer (NEFT/RTGS)
- Cash on Delivery (local only)
- Trusted dealers ke liye credit available

=== RULES ===
1. Hamesha wholesale rates batao, retail customer ko bhi minimum dozen bataao
2. Bade orders ke liye owner se milwane ki offer karo
3. Address aur phone number zaroor batao jab koi dukaan pooche
4. Festival season mein advance booking suggest karo
5. Bahut lamba reply mat karo - WhatsApp mein chhota aur clear rakho
6. Hinglish mein baat karo, friendly aur professional tone rakho`;

// ============================================
// CONVERSATION MEMORY (In-memory, server restart pe reset hogi)
// Production mein Redis ya MongoDB use karo
// ============================================
const conversations = new Map(); // key: phone number, value: messages array

function getHistory(phone) {
  if (!conversations.has(phone)) {
    conversations.set(phone, []);
  }
  return conversations.get(phone);
}

function addToHistory(phone, role, content) {
  const history = getHistory(phone);
  history.push({ role, content });
  // Last 20 messages rakhte hain (memory management)
  if (history.length > 20) history.splice(0, 2);
}

// ============================================
// CLAUDE AI - MESSAGE GENERATE
// ============================================
async function getClaudeReply(phone, userMessage) {
  addToHistory(phone, "user", userMessage);
  const history = getHistory(phone);

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: history,
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.content[0].text;
    addToHistory(phone, "assistant", reply);
    return reply;
  } catch (err) {
    console.error("Claude Error:", err.response?.data || err.message);
    return "Maafi chahta hoon, thodi technical problem ho gayi. Dobara message karein ya seedha call karein: 8957898317 📞";
  }
}

// ============================================
// WHATSAPP - MESSAGE BHEJO
// ============================================
async function sendWhatsAppMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`✅ Message sent to ${to}`);
  } catch (err) {
    console.error("WhatsApp Send Error:", err.response?.data || err.message);
  }
}

// ============================================
// WEBHOOK VERIFY (Meta ka verification)
// ============================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ============================================
// WEBHOOK - INCOMING MESSAGES RECEIVE KARO
// ============================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Meta ko turant 200 do

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from = message.from; // Customer ka phone number
    const msgType = message.type;

    console.log(`📩 Message from ${from}: type=${msgType}`);

    let userText = "";

    if (msgType === "text") {
      userText = message.text.body;
    } else if (msgType === "image") {
      userText = "[Customer ne ek image bheja - filhal text hi support hai]";
    } else if (msgType === "audio") {
      userText = "[Customer ne voice note bheja - text mein likhein please]";
    } else {
      return; // Other types ignore
    }

    // Claude se reply lo
    const reply = await getClaudeReply(from, userText);

    // Customer ko reply karo
    await sendWhatsAppMessage(from, reply);

  } catch (err) {
    console.error("Webhook Error:", err.message);
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (req, res) => {
  res.json({
    status: "✅ KL BROTHER WhatsApp Bot Running!",
    shop: "KL BROTHER - Wholesale Fashion",
    address: "Bardahiya Bazaar, Khalilabad, Sant Kabir Nagar",
    phone: "8957898317",
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║    KL BROTHER - WhatsApp AI Bot      ║
  ║    Server running on port ${PORT}       ║
  ║    Bardahiya Bazaar, Khalilabad      ║
  ╚══════════════════════════════════════╝
  `);
});
