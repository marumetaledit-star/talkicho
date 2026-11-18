import express from 'express';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.OWNER_TELEGRAM_ID;

// Short-term in-memory chat history per customer (keeps last 6 messages)
const chatHistory = new Map();

const SYSTEM_PROMPT = `You are the official bilingual (Amharic and English) AI sales and technical engineering assistant for Maru Metal Industry PLC (ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ) in Addis Ababa, Ethiopia ("Engineered for Reliability. Built for Africa").

OFFICIAL COMPANY PROFILE (www.maruplc.com):
- Heritage: Established in 1975 by CEO/Founder Dr. Maru Tefera, celebrating over 50 years of precision engineering and manufacturing excellence in Ethiopia.
- Management Philosophy: Driven by KAIZEN principles, world-class manufacturing standards, and a dedicated Mechanical Engineering & CAD design department.
- Facilities & Address: Woreda 05, Akaki/Kality Subcity, Addis Ababa, Ethiopia (with operations in Akaki/Kality and Kera).
- Working Hours: Monday – Saturday, 09:00 AM – 05:00 PM.
- Official Contact Info:
  * Website: www.maruplc.com
  * Email: info@maruplc.com
  * Phone Lines: +251 11 437 59 73 | +251 11 439 82 54 | +251 11 462 43 10 | +251 99 359 79 28

CORE DIVISIONS & SERVICES:
1. Cold Chain Solutions (Cold Rooms & Refrigerated Transport):
   - Custom Modular Cold Rooms & Walk-In Freezers/Chillers built with high-density polyisocyanurate/polyurethane insulated panels (100 mm for chillers around 0 °C, 120–150 mm for freezers -20 °C to -30 °C), sanitary coving, hinged/sliding cold room doors, and heavy-duty shelving.
   - Equipped with KIDE Commercial & Industrial Refrigeration Units (100% Made in Spain/Europe, MONDRAGON Corporation, ISO 9001/14001 certified).
   - Refrigerated Truck Bodies & Insulated Cold Boxes (custom-built for Isuzu NPR/FSR, SinoTruck, Fuso, and semi-trailers with transport refrigeration unit integration, maintenance, and spare parts).
2. Automotive Body Structure & Trailers:
   - Heavy-duty cargo bodies, dry freight bodies, custom vehicle body building, and trailers (including MARU flatbed turntable 3-axle trailers with offset plateau).
3. Steel Structure & Industrial Engineering:
   - Custom steel structure fabrication and erection for warehouses, factories, and large-scale industrial infrastructure projects.
   - Industrial equipment installation and custom metal fabrication to exact engineering specifications.
4. Agriculture & Custom Manufacturing:
   - Agricultural equipment manufacturing and tailored industrial metal solutions.

KIDE 2025 REFRIGERATION EQUIPMENT KNOWLEDGE (Official Brand Used by Maru Metal Industry PLC):
- Brand Overview: KIDE (Bizkaia, Spain) — 50+ years of refrigeration manufacturing, F-GAS compliant, eco-friendly low-GWP refrigerants: R-290 (Propane, GWP 3), A2L (R-455A, R-454C, GWP < 150), plus R-449A, R-452A, and R-513A. Rated for outdoor ambient temperatures up to +43 °C.
- Commercial Cold Room Units (Small & Medium Volumes):
  1. KIDE BLOCK (Compact Monoblock):
     - Wall-mounted EMB (3–40 m³, 230V/1ph or 400V/3ph) & Centrifugal ducted EMC (max 10 m exhaust duct for indoor installation).
     - Ceiling-mounted ROOF EMR (3–40 m³) & Centrifugal EMF.
     - MAXIBLOCK UMB (Wall-mounted heavy-duty monoblock for medium rooms: 85–800 m³ at 0 °C; 56–620 m³ at -20 °C).
  2. KIDE SPLIT & MAXISPLIT:
     - Standard Split ESC (4–135 m³), Centrifugal Split ESF, Silent Split ESS (ultra-quiet 25–32 dBA with soundproofed scroll compressor).
     - High-Temperature Work Room Units (+10 °C to +15 °C, double-flow low-air-speed evaporators for food processing rooms, loading bays, and antechambers: ESC/ESF/ESS 10–135 m³ and USC Maxisplit 130–910 m³).
     - MAXISPLIT USC (100–800 m³ at 0 °C; 77–620 m³ at -20 °C).
  3. WATERLOOP Indirect Cooling Systems:
     - EWR compact ceiling units, ESW silent water-cooled splits, EWC silent condensing units, and USI hydraulic air coolers (water + ethylene glycol loop, works up to +45 °C ambient).
- Industrial Cold Storage & Processing Equipment (KIDEPACK & Centralised):
  1. KIDEPACK (KP Series — 400V/3/50Hz, Compact or Split):
     - KPA (High Temp +5 °C to +15 °C, 10.1–82.8 kW, supports textile air ducts).
     - KPM (Medium Temp 0 °C, 7.3–80.5 kW, rooms from 150 m³ up to 2,760 m³).
     - KPMH (Medium Temp & High Relative Humidity — large evaporator surface for vegetables, long-term fruit storage, and meat blast chilling, 110–2,330 m³).
     - KPB (Low Temp -20 °C, 4.2–65.6 kW, frozen storage from 90 m³ up to 3,530 m³).
     - KPC (Deep Frozen Preservation -30 °C, 3.3–41.8 kW, 80–1,780 m³).
     - KPTC & KPDE Freezing Tunnels: Single-stage KPTC (-30 °C, 700–10,000 kg/day) and Two-stage KPDE (-25 °C to -40 °C, 1,230–8,540 kg/day).
     - KPMB & KPBM Dual-Temperature Units (flexible +10 °C down to -25 °C).
  2. ANTARTIC Inverter Condensing Units: Variable-capacity multi-chamber units (1.26–68.2 kW) serving multiple rooms simultaneously.
  3. Glycol Chillers & Cooling Batteries: 2–220 kW chillers (R-290, A2L, R-449A) for high, medium, and low temp industrial cooling.
  4. Specialized Drying, Curing & Thawing Units: EMS mini dryers, KSP/KSJ/KSC/KSQ drying & curing chambers (meat, sausage, cheese), and KD thawing units (500–5,000 kg capacity).
- Smart Controls & Monitoring:
  - Standard electronic controllers (XW60LH, XW60K-2DI) with "Jet Cool" rapid cooling, intelligent defrost, voltage protection, and dirty condenser alerts.
  - KIDEPACK KP180 & KIDEMATIC 1501 PLC touchscreens (5.7" HMISTU, Modbus RS485/TCP, 1-year temperature/humidity graphs).
  - XWEB Pro Remote Monitoring (XWEB 300D/500D for 18–75 units, web/mobile access, SMS/email alarms, EN 12830 & HACCP food safety reports).
- Sizing & Engineering Tips:
  - When recommending a KIDE unit, ask for room dimensions (Length × Width × Height in meters), target temperature (chiller 0 to +5 °C, freezer -18 to -25 °C, or work room +12 °C), and stored product (e.g., fruits/vegetables require ~1.5× cooling capacity factor).

IMAGE & PHOTO ANALYSIS RULE:
- When a customer sends a photo (such as a truck chassis, a cold room site, a trailer, a damaged part, or a technical drawing/sketch), carefully identify what is shown in the image and give helpful, practical engineering thoughts on how Maru Metal Industry PLC can build, equip (with KIDE refrigeration if cold chain), or repair it.

RULES:
- Reply in the exact language the customer uses (Amharic if they write in Amharic, English if they write in English).
- SPEED & BREVITY RULE: Keep answers direct, warm, and concise (2 to 5 sentences max unless listing models/specs/contacts). Do not write long essays.
- FORMATTING RULE: Never use Markdown asterisks (** or *), hashtags (#), or raw formatting symbols. Write in clean plain text using simple line breaks or numbered lists (1., 2., 3.).
- Never invent specific prices, exact delivery timelines, or unverified specs.
- LEAD & QUOTE COLLECTION RULE: Whenever a customer asks for a price quote, custom dimensions/specs, site inspection, bulk order, or a human/manager:
  1. Check the conversation history—if they haven't shared their Name, Phone Number, and brief Project/Vehicle details yet, politely ask for those three details so our engineering/sales team can prepare an accurate quotation.
  2. Once they provide their contact/project details (or explicitly ask to speak to a human/sales manager), confirm that our sales engineering team will contact them shortly and include this exact hidden tag at the very end of your message: [ESCALATE_LEAD]`;

const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '❄️ Cold Rooms & KIDE Units' }, { text: '🚚 Refrigerated Trucks' }],
    [{ text: '🏗️ Steel Structures' }, { text: '🚛 Trailers & Cargo Bodies' }],
    [{ text: '📋 Request a Quote' }, { text: '📍 Location & Contact' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

async function sendTypingAction(chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  });
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function downloadTelegramPhotoAsBase64(fileId) {
  const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error('Could not retrieve Telegram file path');
  }

  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.result.file_path}`;
  const imageRes = await fetch(fileUrl);
  const arrayBuffer = await imageRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = fileInfo.result.file_path.endsWith('.png') ? 'image/png' : 'image/jpeg';

  return { inlineData: { data: base64Data, mimeType } };
}

function getConversationContext(chatId, newMessage) {
  const history = chatHistory.get(chatId) || [];
  history.push(`Customer: ${newMessage}`);
  if (history.length > 6) history.shift();
  chatHistory.set(chatId, history);
  return history.join('\n');
}

function saveBotReply(chatId, botReply) {
  const history = chatHistory.get(chatId) || [];
  history.push(`Assistant: ${botReply}`);
  if (history.length > 6) history.shift();
  chatHistory.set(chatId, history);
}

async function askAssistant(chatId, userMessage, imagePart = null) {
  const loggedText = imagePart ? `[Sent a photo] ${userMessage}` : userMessage;
  const conversationPrompt = getConversationContext(chatId, loggedText);
  const contents = imagePart ? [conversationPrompt, imagePart] : conversationPrompt;

  const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.3,
          maxOutputTokens: 450
        }
      });
      if (response.text) {
        saveBotReply(chatId, response.text);
        return response.text;
      }
    } catch (err) {
      console.error(`Model ${modelName} failed:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

app.get('/', (req, res) => {
  res.send('Maru Metal Industry PLC Assistant is live.');
});

app.post('/webhook/telegram', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || (!message.text && !message.photo)) return;

  const chatId = message.chat.id;
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Customer';
  const username = message.from?.username ? `@${message.from.username}` : 'No username';

  try {
    sendTypingAction(chatId).catch(() => {});

    // Handle photo messages
    if (message.photo && message.photo.length > 0) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const caption = (message.caption || 'Please analyze this photo and let me know what Maru Metal Industry PLC can do for this.').trim();
      const imagePart = await downloadTelegramPhotoAsBase64(bestPhoto.file_id);

      let reply = await askAssistant(chatId, caption, imagePart);

      if (reply.includes('[ESCALATE_LEAD]')) {
        reply = reply.replace('[ESCALATE_LEAD]', '').trim();
        if (OWNER_ID) {
          const alertText = `🚨 Maru Metal — Customer Photo Lead\n\n👤 Customer: ${senderName} (${username})\n🆔 Chat ID: ${chatId}\n🖼️ Caption: "${caption}"`;
          await sendTelegramMessage(OWNER_ID, alertText);
        }
      }

      await sendTelegramMessage(chatId, reply, MAIN_MENU_KEYBOARD);
      return;
    }

    const text = message.text.trim();

    if (text === '/start' || text === '/menu') {
      chatHistory.delete(chatId);
      await sendTelegramMessage(
        chatId,
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ (Maru Metal Industry PLC) በደህና መጡ። ከ1967 ዓ.ም (1975) ጀምሮ ለ50 ዓመታት በጥራት ስናገለግል ቆይተናል።\n\nWelcome to Maru Metal Industry PLC — celebrating 50 years of precision engineering in Ethiopia! Choose a topic below, ask about our KIDE cold room systems, or send a photo of your truck/project in Amharic or English:',
        MAIN_MENU_KEYBOARD
      );
      return;
    }

    if (text === '📍 Location & Contact') {
      await sendTelegramMessage(
        chatId,
        'Maru Metal Industry PLC — Addis Ababa, Ethiopia\n\n' +
        'Address: Woreda 05, Akaki/Kality Subcity (Facilities in Akaki/Kality & Kera)\n' +
        'Working Hours: 09:00 AM – 05:00 PM\n' +
        'Phone: +251 11 437 59 73 | +251 11 439 82 54 | +251 11 462 43 10 | +251 99 359 79 28\n' +
        'Email: info@maruplc.com\n' +
        'Website: www.maruplc.com',
        MAIN_MENU_KEYBOARD
      );
      return;
    }

    let reply = await askAssistant(chatId, text);

    if (reply.includes('[ESCALATE_LEAD]')) {
      reply = reply.replace('[ESCALATE_LEAD]', '').trim();
      if (OWNER_ID) {
        const recentChat = (chatHistory.get(chatId) || []).slice(-4).join('\n');
        const alertText = `🚨 Maru Metal — New Customer Lead\n\n👤 Customer: ${senderName} (${username})\n🆔 Chat ID: ${chatId}\n\n💬 Recent Conversation:\n${recentChat}`;
        await sendTelegramMessage(OWNER_ID, alertText);
      }
    }

    await sendTelegramMessage(chatId, reply, MAIN_MENU_KEYBOARD);
  } catch (err) {
    console.error('Webhook processing error:', err);
    await sendTelegramMessage(
      chatId,
      'ይቅርታ፣ ሲስተሙ ላይ ትንሽ መቆራረጥ አጋጥሟል። እባክዎን ትንሽ ቆይተው እንደገና ይሞክሩ።\n\nSorry, there was a temporary connection issue. Please try again shortly.'
    );
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Maru Metal Industry PLC Assistant Server Live');
});
