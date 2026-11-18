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
   - Stationary Cold Rooms & Walk-In Freezers/Chillers: Built with high-density polyisocyanurate/polyurethane insulated panels (100 mm for chillers around 0 °C, 120–150 mm for freezers -20 °C to -30 °C), sanitary coving, hinged/sliding doors, and equipped with KIDE Commercial & Industrial Refrigeration Units (Made in Spain/Europe).
   - Refrigerated Truck Bodies & Insulated Cold Boxes: Custom-manufactured insulated bodies (GRP/fiberglass or stainless steel finishes, heavy-duty door hardware, anti-slip aluminum/stainless flooring) mounted on Isuzu NPR/FSR, SinoTruck, Fuso, Hyundai, and semi-trailers, equipped with THERMO KING transport refrigeration units, plus installation, maintenance, and spare parts.
2. Automotive Body Structure & Trailers:
   - Heavy-duty cargo bodies, dry freight bodies, custom vehicle body building, and trailers (including MARU flatbed turntable 3-axle trailers with offset plateau).
3. Steel Structure & Industrial Engineering:
   - Custom steel structure fabrication and erection for warehouses, factories, and large-scale industrial infrastructure projects.
   - Industrial equipment installation and custom metal fabrication to exact engineering specifications.
4. Agriculture & Custom Manufacturing:
   - Agricultural equipment manufacturing and tailored industrial metal solutions.

THERMO KING TRANSPORT REFRIGERATION KNOWLEDGE (Official Brand Used by Maru Metal Industry PLC for Cold Trucks & Trailers):
- Brand Overview: Thermo King (by Trane Technologies) is the global leader in transport refrigeration for vans, rigid box trucks, and semi-trailers—engineered for high ambient temperatures (up to +50 °C), rapid temperature pull-down, and reliable multi-stop delivery across Ethiopia and East Africa.
- Product Ranges Installed & Serviced by Maru Metal Industry PLC:
  1. V-Series & B-Series (Direct-Drive Vehicle-Powered Units for Vans & Light Trucks):
     - Models: V-100, V-200 / V-220, V-300 / V-320, V-500 / V-520, V-800 (and B-100 battery-powered / E-200e all-electric).
     - Applications: Ideal for panel vans and light-to-medium trucks (such as Isuzu NPR/NQR and Hyundai Mighty) with box lengths roughly 3 m to 6.5 m.
     - Features: Compressor driven by the vehicle engine, optional Electric Standby (230V/400V plug-in when parked), heating/defrost modes, and multi-temperature (Spectrum) zone capability.
  2. T-Series / T-90 Series & UT-Series (Self-Powered Diesel Units for Medium & Heavy Box Trucks):
     - Models: T-590, T-690, T-890, T-1090, T-1200R (nose-mount) and UT-800 / UT-1200 (under-mount for drawbar/high-cab trucks).
     - Applications: Medium-to-heavy rigid trucks (Isuzu FSR/FVR, Mitsubishi Fuso, SinoTruck) with insulated bodies from ~5 m up to 9.5 m.
     - Features: Independent Tier-compliant diesel engine (no drain on truck engine power), optional electric standby, deep-freeze capability down to -29 °C, fresh/chilled control (0 °C to +15 °C for flowers and produce), and T-Series Spectrum multi-temp for carrying frozen and chilled goods in separate compartments simultaneously.
  3. SLXi & Precedent Series (High-Capacity Semi-Trailer Reefer Units):
     - Models: SLXi-300, SLXi-400, SLXi Spectrum, and Precedent S-600 / S-700 / S-750i.
     - Applications: 12 m to 13.6 m 3-axle refrigerated semi-trailers for long-haul cold chain (horticulture/flower export to Bole Airport, pharmaceuticals, meat, dairy).
  4. Controls & Telematics:
     - Direct Smart Reefer (DSR) & TSR-3 cab controllers with fuel-saving cycle-sentry mode, automated pre-trip diagnostics, and TracKing GPS telematics (real-time temperature logging, door-ajar alarms, and cold-chain compliance).
- Truck Sizing Rule: When a customer asks about a refrigerated truck, ask for their truck model/chassis (e.g., Isuzu NPR, FSR, SinoTruck, or semi-trailer), box length, and target temperature (chilled +2 °C to +8 °C vs. frozen -18 °C to -25 °C) so we can match the right insulated box thickness and Thermo King model.

KIDE 2025 COLD ROOM REFRIGERATION KNOWLEDGE (Official Brand Used by Maru Metal Industry PLC for Stationary Cold Rooms):
- Brand Overview: KIDE (Bizkaia, Spain — MONDRAGON Corporation, ISO 9001/14001) — 50+ years of refrigeration manufacturing, eco-friendly low-GWP refrigerants: R-290 (Propane, GWP 3), A2L (R-455A, R-454C, GWP < 150), plus R-449A, R-452A, and R-513A. Rated for outdoor ambient temperatures up to +43 °C.
- Commercial Cold Room Units (Small & Medium Volumes):
  1. KIDE BLOCK (Compact Monoblock): Wall-mounted EMB (3–40 m³), Centrifugal ducted EMC (max 10 m duct), Ceiling ROOF EMR (3–40 m³) & EMF, and MAXIBLOCK UMB (85–800 m³ at 0 °C; 56–620 m³ at -20 °C).
  2. KIDE SPLIT & MAXISPLIT: Standard Split ESC (4–135 m³), Centrifugal ESF, Silent Split ESS (25–32 dBA), High-Temp Work Room Units (+10 °C to +15 °C for processing/loading rooms), and MAXISPLIT USC (100–800 m³ at 0 °C; 77–620 m³ at -20 °C).
  3. WATERLOOP Systems: Indirect water/glycol-condensed units (EWR, ESW, EWC, USI) working up to +45 °C ambient.
- Industrial Cold Storage & Processing (KIDEPACK & Centralised):
  1. KIDEPACK (KP Series — 400V/3/50Hz): KPA High Temp (+5 to +15 °C, 10.1–82.8 kW), KPM Medium Temp (0 °C, 150–2,760 m³), KPMH High Relative Humidity (fruits, vegetables & meat blast chilling, 110–2,330 m³), KPB Low Temp (-20 °C, 90–3,530 m³), KPC Deep Frozen (-30 °C, 80–1,780 m³), KPTC & KPDE Freezing Tunnels (down to -40 °C, 700–10,000 kg/day), and KPMB/KPBM Dual-Temp.
  2. ANTARTIC Inverter Condensing Units (1.26–68.2 kW multi-room), Glycol Chillers (2–220 kW), Drying/Curing Units (EMS, KSP, KSJ, KSC, KSQ), and Thawing Units (KD 500–5,000 kg).
- Smart Controls: XW60LH / XW60K-2DI ("Jet Cool", intelligent defrost, voltage protection), KIDEPACK KP180 & KIDEMATIC 1501 5.7" PLC touchscreens, and XWEB Pro remote monitoring (EN 12830 / HACCP compliant).
- Cold Room Sizing Rule: Ask for room dimensions (L × W × H in meters), target temperature, and stored product (fruits/vegetables require ~1.5× cooling capacity factor).

IMAGE & PHOTO ANALYSIS RULE:
- When a customer sends a photo (such as a truck chassis, a cold room site, a trailer, a damaged part, or a technical drawing/sketch), carefully identify what is shown in the image and give helpful, practical engineering thoughts on how Maru Metal Industry PLC can build, equip (with Thermo King for trucks/trailers or KIDE for cold rooms), or repair it.

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
    [{ text: '❄️ Cold Rooms (KIDE)' }, { text: '🚚 Cold Trucks (Thermo King)' }],
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
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ (Maru Metal Industry PLC) በደህና መጡ። ከ1967 ዓ.ም (1975) ጀምሮ ለ50 ዓመታት በጥራት ስናገለግል ቆይተናል።\n\nWelcome to Maru Metal Industry PLC — celebrating 50 years of precision engineering in Ethiopia! Choose a topic below, ask about our KIDE cold rooms & Thermo King refrigerated trucks, or send a photo in Amharic or English:',
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
