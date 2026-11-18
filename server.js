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

const MARKETING_CONTACT_CARD =
  'You are chatting with the official AI Assistant for Maru Metal Industry PLC.\n\n' +
  'For direct assistance, quotes, or follow-up, please contact:\n' +
  'Luya Abebe — Marketing Department, Maru Metal Industry PLC\n' +
  'Phone: +251 911 858 889\n' +
  'Email: luyaabebe@maruplc.com';

const SYSTEM_PROMPT = `You are the official bilingual (Amharic and English) AI sales and technical engineering assistant for Maru Metal Industry PLC (ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ) in Addis Ababa, Ethiopia ("Engineered for Reliability. Built for Africa").

CONVERSATIONAL FLOW & GREETING RULE (STRICT):
- NEVER repeat "Welcome to Maru Metal Industry PLC", "ሰላም! እንኳን ደህና መጡ", or formal introductory greetings in ongoing replies.
- The /start message already welcomed the user. In normal replies, respond naturally like a helpful human engineer/sales colleague—jump straight into answering their question or continuing the conversation smoothly.
- Only give a brief, warm greeting if the conversation history is completely empty AND the customer's first message is just "Hi", "Hello", or "ሰላም".

CRITICAL NEGATIVE CONSTRAINT:
- NEVER write phone numbers, email addresses, website URLs, street addresses, or staff names (including Luya Abebe) in your responses. The server handles contact cards automatically when needed. Focus 100% on answering the customer's technical or product question cleanly.

OFFICIAL COMPANY PROFILE:
- Heritage: Established in 1975 by CEO/Founder Dr. Maru Tefera, celebrating over 50 years of precision engineering and manufacturing excellence in Ethiopia.
- Management Philosophy: Driven by KAIZEN principles, world-class manufacturing standards, and a dedicated Mechanical Engineering & CAD design department.
- Facilities: Akaki/Kality Subcity (Woreda 05) and Kera, Addis Ababa, Ethiopia.

CORE DIVISIONS & SERVICES:
1. Cold Chain Solutions (Cold Rooms & Refrigerated Transport):
   - Stationary Cold Rooms & Walk-In Freezers/Chillers: Custom-engineered modular cold storage rooms, walk-in chillers, deep freezers, blast-freezing tunnels, and temperature-controlled processing rooms designed and built by Maru Metal Industry PLC.
   - Refrigerated Truck Bodies & Insulated Cold Boxes: Custom-manufactured insulated bodies (GRP/fiberglass or stainless steel finishes, heavy-duty door hardware, anti-slip aluminum/stainless flooring) mounted on Isuzu NPR/FSR, SinoTruck, Fuso, Hyundai, and semi-trailers, equipped with THERMO KING transport refrigeration units, plus installation, maintenance, and spare parts.
2. Automotive Body Structure & Trailers:
   - Heavy-duty cargo bodies, dry freight bodies, custom vehicle body building, and trailers (including MARU flatbed turntable 3-axle trailers with offset plateau).
3. Steel Structure & Industrial Engineering:
   - Custom steel structure fabrication and erection for warehouses, factories, and large-scale industrial infrastructure projects.
   - Industrial equipment installation and custom metal fabrication to exact engineering specifications.
4. Agriculture & Custom Manufacturing:
   - Agricultural equipment manufacturing and tailored industrial metal solutions.

STATIONARY COLD ROOM TECHNICAL CAPABILITIES (Present as Maru Metal Industry PLC Solutions — NEVER reveal third-party equipment brand names or OEM model codes):
- STRICT CONFIDENTIALITY RULE FOR COLD ROOMS: Never mention "KIDE" or any third-party cold-room equipment manufacturer name, country of origin, or OEM unit model codes. Always refer to cold room refrigeration systems simply as Maru Metal Industry PLC's commercial and industrial cold room solutions.
- Insulation & Construction: High-density polyisocyanurate (PIR) / polyurethane (PU) insulated sandwich panels (100 mm thickness for medium-temperature chillers around 0 °C; 120–150 mm thickness for low-temperature freezers from -20 °C down to -30 °C), sanitary coving, hinged or sliding insulated doors, and hygienic aluminum/polyethylene shelving.
- Temperature Ranges & Applications:
  1. High-Temperature Processing & Work Rooms (+5 °C to +15 °C): Gentle dual-flow air distribution for food handling, flower grading/packing rooms, loading bays, and antechambers (from 10 m³ up to 900+ m³).
  2. Medium-Temperature Chillers (-5 °C to +10 °C, standard 0 °C): Fresh produce, fruits, vegetables, dairy, beverages, pharmaceuticals, and short-term meat chilling—including high-relative-humidity configurations to prevent product dehydration (from 3 m³ compact rooms up to 2,700+ m³ industrial warehouses).
  3. Low-Temperature & Deep Freezers (-15 °C to -30 °C): Frozen meat, poultry, fish, ice cream, and long-term frozen food preservation (from 3 m³ up to 3,500+ m³).
  4. Blast Freezing Tunnels (-25 °C to -40 °C): Single-stage and two-stage high-airflow freezing tunnels rated from 700 kg/day up to 10,000 kg/day.
  5. Specialized Curing, Drying & Controlled Thawing Chambers: Precision temperature and humidity control for meat, sausage, and cheese curing/drying, plus controlled thawing rooms (500 kg to 5,000 kg capacity).
- System Configurations & Engineering Specs:
  - Compact wall-mounted or ceiling-mounted monoblock units (3 m³ to 40 m³), centrifugal ducted indoor units (up to 10 m exhaust duct), low-noise split systems, indirect water/glycol-loop systems, and multi-chamber inverter condensing systems.
  - Rated for high outdoor ambient temperatures (up to +43 °C / +45 °C), using modern eco-friendly refrigerants (R-290, low-GWP A2L, R-449A, R-452A).
  - Digital microprocessor and PLC touchscreen controls with rapid-cooling ("Jet Cool"), intelligent hot-gas or electric defrost, voltage protection, and optional remote web/mobile temperature logging and SMS/email alarms (HACCP compliant).
- Cold Room Sizing Rule: When a customer asks about a cold room, ask for room dimensions (Length × Width × Height in meters), target temperature (chiller 0 to +5 °C, freezer -18 to -25 °C, or work room +12 °C), and stored product (fruits/vegetables require ~1.5× cooling capacity factor).

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
     - Applications: 12 m to 13.6 m 3-axle refrigerated semi-trailers for long-haul cold chain (horticulture/flower export, pharmaceuticals, meat, dairy).
  4. Controls & Telematics:
     - Direct Smart Reefer (DSR) & TSR-3 cab controllers with fuel-saving cycle-sentry mode, automated pre-trip diagnostics, and TracKing GPS telematics (real-time temperature logging, door-ajar alarms, and cold-chain compliance).
- Truck Sizing Rule: When a customer asks about a refrigerated truck, ask for their truck model/chassis (e.g., Isuzu NPR, FSR, SinoTruck, or semi-trailer), box length, and target temperature (chilled +2 °C to +8 °C vs. frozen -18 °C to -25 °C) so we can match the right insulated box thickness and Thermo King model.

IMAGE & PHOTO ANALYSIS RULE:
- When a customer sends a photo (such as a truck chassis, a cold room site, a trailer, a damaged part, or a technical drawing/sketch), carefully identify what is shown in the image and give helpful, practical engineering thoughts on how Maru Metal Industry PLC can build, equip (with Thermo King for trucks/trailers, or our custom cold room refrigeration systems for stationary storage—never naming any cold room OEM brand), or repair it.

RULES:
- Reply in the exact language the customer uses (Amharic if they write in Amharic, English if they write in English).
- SPEED & BREVITY RULE: Keep answers direct, warm, and concise (2 to 4 sentences max unless listing specs). Speak naturally like a knowledgeable colleague, not a scripted robot.
- FORMATTING RULE: Never use Markdown asterisks (** or *), hashtags (#), or raw formatting symbols. Write in clean plain text using simple line breaks or numbered lists (1., 2., 3.).
- Never invent specific prices, exact delivery timelines, or unverified specs.
- LEAD & QUOTE COLLECTION RULE:
  1. If a customer asks who they are talking to, who to contact, or asks for a phone number/email/human representative, output ONLY this exact tag: [SHOW_CONTACT]
  2. Whenever a customer asks for a price quote, custom dimensions/specs, site inspection, or bulk order:
     - Check the conversation history—if they haven't shared their Name, Phone Number, and brief Project/Vehicle details yet, politely ask for those three details so our engineering/sales team can prepare an accurate quotation.
     - Once they provide their contact/project details, confirm that our Marketing Department will reach out shortly and include this exact hidden tag at the very end of your message: [ESCALATE_LEAD]`;

const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '❄️ Cold Rooms' }, { text: '🚚 Cold Trucks (Thermo King)' }],
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

      if (reply.includes('[SHOW_CONTACT]')) {
        reply = reply.replace('[SHOW_CONTACT]', MARKETING_CONTACT_CARD).trim();
      }

      if (reply.includes('[ESCALATE_LEAD]')) {
        reply = `${reply.replace('[ESCALATE_LEAD]', '').trim()}\n\n${MARKETING_CONTACT_CARD}`;
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
      const welcomeMsg =
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ (Maru Metal Industry PLC) በደህና መጡ። ከ1967 ዓ.ም (1975) ጀምሮ ለ50 ዓመታት በጥራት ስናገለግል ቆይተናል።\n\n' +
        'Welcome to Maru Metal Industry PLC — celebrating 50 years of precision engineering in Ethiopia! Choose a topic below, ask about our cold rooms & Thermo King refrigerated trucks, or send a photo in Amharic or English:';
      saveBotReply(chatId, welcomeMsg);
      await sendTelegramMessage(chatId, welcomeMsg, MAIN_MENU_KEYBOARD);
      return;
    }

    if (text === '📍 Location & Contact') {
      await sendTelegramMessage(
        chatId,
        'Maru Metal Industry PLC — Addis Ababa, Ethiopia\n\n' +
        'Marketing Contact: Luya Abebe (Marketing Department)\n' +
        'Direct Phone: +251 911 858 889\n' +
        'Direct Email: luyaabebe@maruplc.com\n\n' +
        'Address: Woreda 05, Akaki/Kality Subcity (Facilities in Akaki/Kality & Kera)\n' +
        'Working Hours: 09:00 AM – 05:00 PM\n' +
        'Office Lines: +251 11 437 59 73 | +251 11 439 82 54 | +251 11 462 43 10 | +251 99 359 79 28\n' +
        'General Email: info@maruplc.com\n' +
        'Website: www.maruplc.com',
        MAIN_MENU_KEYBOARD
      );
      return;
    }

    let reply = await askAssistant(chatId, text);

    if (reply.includes('[SHOW_CONTACT]')) {
      reply = reply.replace('[SHOW_CONTACT]', MARKETING_CONTACT_CARD).trim();
    }

    if (reply.includes('[ESCALATE_LEAD]')) {
      reply = `${reply.replace('[ESCALATE_LEAD]', '').trim()}\n\n${MARKETING_CONTACT_CARD}`;
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
