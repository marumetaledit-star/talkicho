import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import 'dotenv/config';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({}); // Automatically reads your GEMINI_API_KEY
const {
  TELEGRAM_BOT_TOKEN,
  META_ACCESS_TOKEN,
  META_VERIFY_TOKEN,
  WHATSAPP_PHONE_ID,
  OWNER_TELEGRAM_ID
} = process.env;

// =========================================================
// MARU METAL INDUSTRY PLC — PRE-LOADED KNOWLEDGE BASE
// =========================================================
const TALKICHO_KNOWLEDGE_BASE = `
You are ቶኪቾ (Talkicho), the official AI customer assistant for Maru Metal Industry PLC (MMI).
Reply warmly, professionally, and concisely in the exact language the customer uses (Amharic አማርኛ or English).

=== COMPANY PROFILE ===
- Company Name: Maru Metal Industry PLC (MMI)
- Established: 1975 (Over 50 years of engineering and manufacturing excellence in Ethiopia)
- Location: Woreda 05, Akaki/Kality Subcity, Addis Ababa, Ethiopia
- Contact Phones: +251 11 462 43 10 | +251 11 439 82 54 | +251 99 359 79 28
- Email & Website: info@maruplc.com | www.maruplc.com
- Working Hours: Monday – Saturday, 8:00 AM – 5:00 PM EAT

=== CORE AREAS OF OPERATION ===
1. Cold Chain Solutions: Design, supply, installation, and maintenance of cold rooms, cold storage facilities, and refrigeration systems for food, agriculture, flowers, and pharmaceuticals.
2. Refrigerated Transport: Fabrication of insulated truck, van, and trailer bodies, including the installation of imported refrigeration units.
3. Steel Structures: Design, fabrication, and installation of industrial steel structures, pre-engineered buildings, trusses, silos, and related metal works.
4. Cargo Bodies: Custom fabrication of dry cargo vehicle bodies, tankers, trailers, and specialized transport enclosures.

=== STRICT RULES ===
1. Answer ONLY using the company facts above. Never invent or guess product prices, lead times, or technical stock availability.
2. When a customer asks about a product (e.g., cold room or refrigerated truck body), ask helpful clarifying questions about their required dimensions, temperature range, or vehicle chassis model so our engineers can prepare an accurate proposal.
3. ALWAYS set "needs_human_handoff" to true whenever a customer requests:
   - A price quote, proforma invoice, or tender bid
   - Custom engineering dimensions or site inspection
   - Maintenance/repair support or spare parts
   - Speaking directly with an engineer or sales manager
   When escalating, politely inform the customer in their language that a Maru Metal Industry PLC sales engineer is reviewing their request and will follow up shortly (and share our direct office phone +251 11 462 43 10 or info@maruplc.com).
`;

const replySchema = {
  type: Type.OBJECT,
  properties: {
    reply_text: { type: Type.STRING },
    needs_human_handoff: { type: Type.BOOLEAN },
    handoff_reason: { type: Type.STRING }
  },
  required: ['reply_text', 'needs_human_handoff']
};

const sessions = new Map();

// Core Gemini Brain shared across Telegram, WhatsApp, Instagram & Facebook
async function askTalkicho(sessionKey, customerText) {
  const history = sessions.get(sessionKey) || [];
  history.push({ role: 'user', parts: [{ text: customerText }] });
  if (history.length > 10) history.splice(0, history.length - 10);

  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: history,
    config: {
      systemInstruction: TALKICHO_KNOWLEDGE_BASE,
      responseMimeType: 'application/json',
      responseSchema: replySchema,
      temperature: 0.3
    }
  });

  const decision = JSON.parse(res.text);
  history.push({ role: 'model', parts: [{ text: decision.reply_text }] });
  sessions.set(sessionKey, history);
  return decision;
}

// Alert you privately on Telegram when a customer requests a quote or engineer
async function notifyOwner(platform, customerId, reason, lastMsg) {
  if (!OWNER_TELEGRAM_ID || !TELEGRAM_BOT_TOKEN) return;
  const text = `🚨 Maru Metal — ቶኪቾ Lead/Handoff (${platform})\nCustomer: ${customerId}\nReason: ${reason}\nMessage: "${lastMsg}"`;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: OWNER_TELEGRAM_ID, text })
  });
}

// 1. TELEGRAM WEBHOOK (/webhook/telegram)
app.post('/webhook/telegram', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.business_message || req.body.message;
  if (!msg?.text || msg.from?.is_bot) return;

  const decision = await askTalkicho(`tg:${msg.chat.id}`, msg.text);
  const payload = { chat_id: msg.chat.id, text: decision.reply_text };
  if (msg.business_connection_id) payload.business_connection_id = msg.business_connection_id;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (decision.needs_human_handoff) {
    const customerLabel = `${msg.from.first_name || ''} ${msg.from.username ? '(@' + msg.from.username + ')' : ''}`.trim() || msg.chat.id;
    await notifyOwner('Telegram', customerLabel, decision.handoff_reason, msg.text);
  }
});

// 2. META WEBHOOK: WHATSAPP, INSTAGRAM & FACEBOOK (/webhook/meta)
app.get('/webhook/meta', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === META_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook/meta', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;

  // WhatsApp messages
  if (body.object === 'whatsapp_business_account') {
    const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg?.text?.body) return;

    const decision = await askTalkicho(`wa:${msg.from}`, msg.text.body);
    await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.from,
        text: { body: decision.reply_text }
      })
    });
    if (decision.needs_human_handoff) {
      await notifyOwner('WhatsApp', msg.from, decision.handoff_reason, msg.text.body);
    }
  }

  // Instagram DMs & Facebook Messenger
  if (body.object === 'instagram' || body.object === 'page') {
    const event = body.entry?.[0]?.messaging?.[0];
    if (!event?.message?.text || event.message.is_echo) return;

    const platform = body.object === 'instagram' ? 'Instagram' : 'Facebook';
    const senderId = event.sender.id;
    const decision = await askTalkicho(`${platform}:${senderId}`, event.message.text);

    await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${META_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: decision.reply_text }
      })
    });
    if (decision.needs_human_handoff) {
      await notifyOwner(platform, senderId, decision.handoff_reason, event.message.text);
    }
  }
});

app.get('/', (req, res) => res.send('ቶኪቾ (Talkicho) — Maru Metal Industry PLC Server is Online!'));

app.listen(process.env.PORT || 3000, () => console.log('ቶኪቾ (Talkicho) Server Live for Maru Metal Industry PLC'));
