// ============================================
// KL BROTHER - WhatsApp Business API Server
// ============================================
// Stack: Node.js + Express + Twilio + Gemini AI
// ============================================

require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// Twilio incoming webhooks URL-encoded format mein aate hain
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ============================================
// ENV VARIABLES (Railway mein daalna hai)
// ============================================
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

// Initialize Twilio & Gemini
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ============================================
// SYSTEM PROMPT
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

👨 MEN:
- Men's T-shirts & Polos: ₹150-₹400/piece
- Men's Shirts (Casual & Formal): ₹200-₹600/piece
- Men's Jeans & Trousers: ₹300-₹900/piece
- Men's Kurta & Pyjama: ₹250-₹800/set

👩 WOMEN:
- Women's Kurtis & Tops: ₹150-₹600/piece
- Women's Saree: ₹400-₹2000/piece
- Salwar Suit (3 piece): ₹500-₹2500/set

=== WHOLESALE RULES ===
- Minimum order: 12 piece / 1 dozen (ek design mein)
- 50+ pieces: 10% extra discount
- 100+ pieces: 15% extra discount

=== RULES ===
1. Hamesha wholesale rates batao, retail customer ko bhi minimum dozen bataao.
2. Bade orders ke liye owner se milwane ki offer karo.
3. Address aur phone number zaroor batao jab koi dukaan pooche.
4. Bahut lamba reply mat karo - WhatsApp mein chhota aur clear rakho.
5. Hinglish mein baat karo, friendly aur professional tone rakho.`;

// Initialize Gemini Model with System Prompt
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", // Fast and efficient model
  systemInstruction: SYSTEM_PROMPT,
});

// ============================================
// CONVERSATION MEMORY (In-memory)
// ============================================
const chats = new Map();

async function getGeminiReply(phone, userMessage) {
  try {
    // Agar customer naya hai, toh uski nayi chat history banao
    if (!chats.has(phone)) {
      chats.set(phone, model.startChat({ history: [] }));
    }
    
    const chatSession = chats.get(phone);
    const result = await chatSession.sendMessage(userMessage);
    return result.response.text();
    
  } catch (err) {
    console.error("Gemini Error:", err);
    return "Maafi chahta hoon, thodi technical problem ho gayi. Dobara message karein ya seedha call karein: 8957898317 📞";
  }
}

// ============================================
// TWILIO WEBHOOK - INCOMING MESSAGES
// ============================================
app.post("/webhook", async (req, res) => {
  const fromNumber = req.body.From; // Customer ka number (e.g., whatsapp:+91...)
  const toNumber = req.body.To;     // Twilio Sandbox number
  const userText = req.body.Body;   // Customer ka message

  if (!fromNumber || !userText) {
    return res.status(400).send("Invalid request");
  }

  console.log(`📩 Message from ${fromNumber}: ${userText}`);

  try {
    // AI se reply lo
    const replyText = await getGeminiReply(fromNumber, userText);

    // Twilio ke zariye wapas WhatsApp par bhejo
    await twilioClient.messages.create({
      body: replyText,
      from: toNumber,
      to: fromNumber
    });

    console.log(`✅ Reply sent to ${fromNumber}`);
    res.status(200).send("Message processed");

  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (req, res) => {
  res.json({
    status: "✅ KL BROTHER WhatsApp Bot Running with Gemini AI & Twilio!",
    shop: "KL BROTHER - Wholesale Fashion",
    phone: "8957898317"
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║    KL BROTHER - WhatsApp AI Bot      ║
  ║    Server running on port ${PORT}       ║
  ║    AI: Gemini | Provider: Twilio     ║
  ╚══════════════════════════════════════╝
  `);
});
