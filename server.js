import express from 'express';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.OWNER_TELEGRAM_ID;

const SYSTEM_PROMPT = `You are the official bilingual (Amharic and English) AI sales and customer support assistant for Maru Metal Industry PLC (ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ) in Addis Ababa, Ethiopia ("Engineered for Reliability. Built for Africa").

COMPANY KNOWLEDGE:
- Website: www.maruplc.com
- Core Business: Industrial engineering and manufacturing of commercial cold-chain transport and steel infrastructure in Ethiopia.
- Product Lines:
  1. Refrigerated Truck Bodies & Insulated Cold Boxes (Isuzu NPR/FSR, SinoTruck, Fuso, semi-trailers; insulated polyurethane panels, stainless steel/GRP finishes, heavy-duty hardware).
  2. Cold Rooms & Modular Walk-In Freezers/Chillers (flowers, fresh produce, pharmaceuticals, dairy, meat processing).
  3. Custom Steel Fabrication, Heavy Vehicle Body Building, & Industrial Metal Works.
  4. Commercial Transport Refrigeration Unit Integration, Maintenance & Spare Parts.

RULES:
- Reply in the exact language the customer uses (Amharic or English).
- SPEED & BREVITY RULE: Keep answers direct, warm, and short (2 to 4 sentences max unless listing products). Do not write long essays.
- FORMATTING RULE: Never use Markdown asterisks (** or *), hashtags (#), or formatting symbols. Write in clean plain text.
- Never invent prices, lead times, or unverified specs.
- LEAD & ESCALATION RULE: Whenever a customer asks for a price quote, custom dimensions/specs, site inspection, bulk order, or a human/manager:
  1. Politely ask for their Name, Phone Number, and brief project/vehicle details so our engineering/sales team can prepare a quotation.
  2. At the very end of your message, include the exact hidden tag: [ESCALATE_LEAD]`;

async function sendTypingAction(chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  });
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function askAssistant(userMessage) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: userMessage,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 300,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
  return response.text || 'ይቅርታ፣ ትንሽ ቆይተው እንደገና ይሞክሩ። / Sorry, please try again shortly.';
}

app.get('/', (req, res) => {
  res.send('Maru Metal Industry PLC Assistant is live.');
});

app.post('/webhook/telegram', async (req, res) => {
  res.sendStatus(200);

  try {
    const message = req.body?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Customer';
    const username = message.from?.username ? `@${message.from.username}` : 'No username';

    // Immediately show "typing..." in Telegram
    sendTypingAction(chatId).catch(() => {});

    if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ (Maru Metal Industry PLC) በደህና መጡ።\n\nስለ ቀዝቃዛ መጋዘኖች (Cold Rooms)፣ ፍሪጅ ያላቸው የጭነት መኪና አካላት (Refrigerated Truck Bodies) ወይም ስለ ብረታ ብረት ስራዎቻችን ምን ልርዳዎት?\n\nWelcome to Maru Metal Industry PLC! How can I help you today with refrigerated truck bodies, cold rooms, or custom steel fabrication?'
      );
      return;
    }

    let reply = await askAssistant(text);

    if (reply.includes('[ESCALATE_LEAD]')) {
      reply = reply.replace('[ESCALATE_LEAD]', '').trim();
      if (OWNER_ID) {
        const alertText = `🚨 Maru Metal — New Lead/Handoff\n\n👤 From: ${senderName} (${username})\n🆔 Chat ID: ${chatId}\n💬 Message: "${text}"`;
        await sendTelegramMessage(OWNER_ID, alertText);
      }
    }

    await sendTelegramMessage(chatId, reply);
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Maru Metal Industry PLC Assistant Server Live');
});
