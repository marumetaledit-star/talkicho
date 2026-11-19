import express from 'express';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = String(process.env.OWNER_TELEGRAM_ID || '').trim();

// Short-term AI context per customer (keeps last 6 turns for fast responses)
const chatHistory = new Map();

// Full customer CRM & transcript log for owner review
const customerLogs = new Map();

const MARKETING_CONTACT_CARD =
  'You are chatting with the official AI Assistant for Maru Metal Industry PLC.\n\n' +
  'For direct assistance, quotes, or follow-up, please contact:\n' +
  'Luya Abebe — Marketing Department, Maru Metal Industry PLC\n' +
  'Phone: +251 911 858 889\n' +
  'Email: luyaabebe@maruplc.com';

const SYSTEM_PROMPT = `You are the official bilingual (Amharic and English) AI sales and technical engineering assistant for Maru Metal Industry PLC (ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ) in Addis Ababa, Ethiopia ("Engineered for Reliability. Built for Africa").

LANGUAGE QUALITY & SPELLING RULE (STRICT):
- Write in clean, natural, well-structured language with zero spelling, Fidel, or grammar mistakes in both English and Amharic.
- When replying in Amharic, use authentic, natural Ethiopian Amharic phrasing and accurate Fidel orthography:
  * Cold room = ቀዝቃዛ መጋዘን
  * Walk-in freezer = የማቀዝቀዣ ክፍል / ዲፕ ፍሪዘር
  * Refrigerated truck = ፍሪጅ ያለው የጭነት መኪና
  * Steel structure = የብረት ግንባታ
  * Trailer / cargo body = ተሳቢ እና የጭነት አካል
  * Price quote / quotation = የዋጋ ዝርዝር / ኮቴሽን
  * Insulation panel = የሙቀት መከላከያ ፓነል
- Never produce awkward word-for-word machine translations from English into Amharic. Write the way a polite, educated Ethiopian engineer or sales specialist speaks in Addis Ababa.
- Keep sentences clear, well-structured, and easy to read (and easy to pronounce aloud when converted to voice).

FRIENDLY CONVERSATION & SMALL TALK RULE:
- Be warm, personable, and enjoyable to talk to. Customers often bring up random everyday topics, jokes, Addis Ababa weather/traffic, coffee, or casual banter—engage with them naturally, politely, and with light, friendly humor like a real human colleague.
- After enjoying a brief casual exchange, naturally leave the door open to help whenever they are ready (for example, asking how their business is going or if they have any cold room, refrigerated truck, or steel projects in mind) without sounding pushy or robotic.

CONVERSATIONAL FLOW & GREETING RULE (STRICT):
- NEVER repeat "Welcome to Maru Metal Industry PLC", "ሰላም! እንኳን ደህና መጡ", or formal introductory greetings in ongoing replies.
- The /start message already welcomed the user. In normal replies, jump straight into the conversation naturally.
- Only give a brief, friendly greeting if the conversation history is completely empty AND the customer's first message is just "Hi", "Hello", or "ሰላም".

CRITICAL NEGATIVE CONSTRAINT:
- NEVER write phone numbers, email addresses, website URLs, street addresses, or staff names (including Luya Abebe) in your responses. The server handles contact cards automatically when needed.

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

IMAGE & VOICE ANALYSIS RULE:
- When a customer sends a photo, identify what is shown and give practical engineering thoughts on how Maru Metal Industry PLC can build, equip (with Thermo King for trucks/trailers, or our custom cold room refrigeration systems for stationary storage—never naming any cold room OEM brand), or repair it.
- When a customer sends a voice message (in Amharic or English), listen carefully and reply naturally in the exact same language they spoke.

RULES:
- Reply in the exact language the customer uses (Amharic if they write or speak in Amharic, English if they write or speak in English).
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

// Automatically extracts phone numbers and emails shared by a customer
function extractContactDetails(text) {
  const phones = text.match(/(?:\+251|0)?9\d{8}|\+?\d[\d\s-]{7,14}\d/g) || [];
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return {
    phones: [...new Set(phones.map((p) => p.trim()))],
    emails: [...new Set(emails.map((e) => e.trim()))]
  };
}

// Saves full transcript and contact info per customer
function recordCustomerLog(chatId, senderName, username, role, text) {
  const id = String(chatId);
  if (OWNER_ID && id === OWNER_ID) return; // Don't log owner's own admin tests as customer leads

  const existing = customerLogs.get(id) || {
    chatId: id,
    name: senderName,
    username,
    phones: [],
    emails: [],
    escalated: false,
    lastActive: new Date().toISOString(),
    messages: []
  };

  existing.name = senderName || existing.name;
  existing.username = username || existing.username;
  existing.lastActive = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' });

  if (role === 'Customer') {
    const found = extractContactDetails(text);
    for (const p of found.phones) {
      if (!existing.phones.includes(p)) existing.phones.push(p);
    }
    for (const e of found.emails) {
      if (!existing.emails.includes(e)) existing.emails.push(e);
    }
  }

  existing.messages.push(`${role}: ${text}`);
  if (existing.messages.length > 30) {
    existing.messages.shift();
  }

  customerLogs.set(id, existing);
}

// Splits long transcripts into chunks under Telegram's 4096-character message limit
async function sendLongTelegramMessage(chatId, fullText, replyMarkup = null) {
  const MAX_LEN = 3800;
  if (fullText.length <= MAX_LEN) {
    await sendTelegramMessage(chatId, fullText, replyMarkup);
    return;
  }

  const lines = fullText.split('\n');
  let chunk = '';
  for (const line of lines) {
    if ((chunk + '\n' + line).length > MAX_LEN) {
      await sendTelegramMessage(chatId, chunk.trim());
      chunk = line;
    } else {
      chunk = chunk ? `${chunk}\n${line}` : line;
    }
  }
  if (chunk.trim()) {
    await sendTelegramMessage(chatId, chunk.trim(), replyMarkup);
  }
}

async function sendChatAction(chatId, action = 'typing') {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action })
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

async function sendTelegramVoice(chatId, audioBuffer, mimeType = 'audio/wav') {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`;
  const ext = mimeType.includes('ogg') ? 'ogg' : 'wav';
  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  formData.append('voice', new Blob([audioBuffer], { type: mimeType }), `reply.${ext}`);

  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram sendVoice failed: ${JSON.stringify(data)}`);
  }
}

async function downloadTelegramFileAsBase64(fileId, fallbackMime) {
  const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error('Could not retrieve Telegram file path');
  }

  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  const arrayBuffer = await fileRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  let mimeType = fallbackMime;
  if (fileInfo.result.file_path.endsWith('.png')) mimeType = 'image/png';
  else if (fileInfo.result.file_path.endsWith('.oga') || fileInfo.result.file_path.endsWith('.ogg')) mimeType = 'audio/ogg';
  else if (fileInfo.result.file_path.endsWith('.mp3')) mimeType = 'audio/mpeg';

  return { inlineData: { data: base64Data, mimeType } };
}

function pcmToWavBuffer(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function generateGeminiVoice(textToSpeak) {
  const ttsModels = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts'];
  for (const modelName of ttsModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: textToSpeak,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Achird' }
            }
          }
        }
      });

      const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part) {
        const rawBuffer = Buffer.from(part.inlineData.data, 'base64');
        const mime = part.inlineData.mimeType || 'audio/wav';
        if (mime.includes('pcm') || mime.includes('L16')) {
          return { buffer: pcmToWavBuffer(rawBuffer), mimeType: 'audio/wav' };
        }
        return { buffer: rawBuffer, mimeType: mime };
      }
    } catch (err) {
      console.error(`TTS model ${modelName} failed:`, err.message || err);
    }
  }
  return null;
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

async function askAssistant(chatId, userMessage, mediaPart = null, mediaLabel = '') {
  const loggedText = mediaPart ? `[${mediaLabel}] ${userMessage}` : userMessage;
  const conversationPrompt = getConversationContext(chatId, loggedText);
  const contents = mediaPart ? [conversationPrompt, mediaPart] : conversationPrompt;

  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.35,
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
  if (!message || (!message.text && !message.photo && !message.voice && !message.audio)) return;

  const chatId = message.chat.id;
  const isOwner = OWNER_ID && String(chatId) === OWNER_ID;
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Customer';
  const username = message.from?.username ? `@${message.from.username}` : 'No username';

  try {
    // =========================================================================
    // PRIVATE OWNER ADMIN COMMANDS (Only works for OWNER_TELEGRAM_ID)
    // =========================================================================
    if (isOwner && message.text) {
      const adminCmd = message.text.trim();

      // View list of all customers and their contact details
      if (adminCmd === '/leads') {
        if (customerLogs.size === 0) {
          await sendTelegramMessage(chatId, 'No customer conversations recorded yet since the last server restart.');
          return;
        }

        let summary = `📊 Maru Metal — Customer Conversations (${customerLogs.size})\n\n`;
        let index = 1;
        for (const log of customerLogs.values()) {
          const phoneStr = log.phones.length > 0 ? log.phones.join(', ') : 'Not shared yet';
          const emailStr = log.emails.length > 0 ? log.emails.join(', ') : 'Not shared yet';
          const status = log.escalated ? '🔥 Quote/Lead Requested' : '💬 Browsing/Chatting';
          summary +=
            `${index}. ${log.name} (${log.username})\n` +
            `   ID: ${log.chatId}\n` +
            `   Status: ${status}\n` +
            `   Phone: ${phoneStr}\n` +
            `   Email: ${emailStr}\n` +
            `   Last Active: ${log.lastActive}\n` +
            `   View Full Chat: /chat_${log.chatId}\n\n`;
          index++;
        }

        await sendLongTelegramMessage(chatId, summary);
        return;
      }

      // View full conversation transcript with a specific customer (/chat_12345 or /chat 12345)
      if (adminCmd.startsWith('/chat')) {
        const targetId = adminCmd.replace('/chat_', '').replace('/chat', '').trim();
        const log = customerLogs.get(targetId);

        if (!log) {
          await sendTelegramMessage(chatId, `No conversation found for ID "${targetId}". Send /leads to see all active customer IDs.`);
          return;
        }

        const phoneStr = log.phones.length > 0 ? log.phones.join(', ') : 'Not shared yet';
        const emailStr = log.emails.length > 0 ? log.emails.join(', ') : 'Not shared yet';
        const transcript =
          `🗂️ Full Conversation Transcript\n\n` +
          `👤 Customer: ${log.name} (${log.username})\n` +
          `🆔 Chat ID: ${log.chatId}\n` +
          `📞 Phone: ${phoneStr}\n` +
          `📧 Email: ${emailStr}\n` +
          `🕒 Last Active: ${log.lastActive}\n` +
          `────────────────────\n` +
          `${log.messages.join('\n\n')}`;

        await sendLongTelegramMessage(chatId, transcript);
        return;
      }

      // Clear stored customer logs
      if (adminCmd === '/clearleads') {
        customerLogs.clear();
        await sendTelegramMessage(chatId, 'All stored customer conversation logs have been cleared.');
        return;
      }
    }

    // =========================================================================
    // 1. Handle Voice / Audio messages
    // =========================================================================
    if (message.voice || message.audio) {
      sendChatAction(chatId, 'record_voice').catch(() => {});
      const audioObj = message.voice || message.audio;
      const audioPart = await downloadTelegramFileAsBase64(audioObj.file_id, audioObj.mime_type || 'audio/ogg');

      recordCustomerLog(chatId, senderName, username, 'Customer', '[Sent a voice message]');

      let reply = await askAssistant(
        chatId,
        'Listen carefully to this customer voice message and reply naturally in the exact same language they spoke, with accurate spelling and grammar.',
        audioPart,
        'Sent a voice note'
      );

      if (reply.includes('[SHOW_CONTACT]')) {
        reply = reply.replace('[SHOW_CONTACT]', MARKETING_CONTACT_CARD).trim();
      }

      if (reply.includes('[ESCALATE_LEAD]')) {
        reply = `${reply.replace('[ESCALATE_LEAD]', '').trim()}\n\n${MARKETING_CONTACT_CARD}`;
        recordCustomerLog(chatId, senderName, username, 'Assistant', reply);
        const log = customerLogs.get(String(chatId));
        if (log) log.escalated = true;

        if (OWNER_ID) {
          const phoneStr = log?.phones?.length ? log.phones.join(', ') : 'Check transcript';
          const fullTranscript = log ? log.messages.join('\n') : 'Sent a voice message';
          const alertText =
            `🚨 Maru Metal — Customer Voice Lead\n\n` +
            `👤 Customer: ${senderName} (${username})\n` +
            `🆔 Chat ID: ${chatId}\n` +
            `📞 Detected Phone: ${phoneStr}\n\n` +
            `💬 Full Conversation:\n${fullTranscript}`;
          await sendLongTelegramMessage(OWNER_ID, alertText);
        }
      } else {
        recordCustomerLog(chatId, senderName, username, 'Assistant', reply);
      }

      const voiceAudio = await generateGeminiVoice(reply);
      if (voiceAudio) {
        await sendTelegramVoice(chatId, voiceAudio.buffer, voiceAudio.mimeType);
      }
      await sendTelegramMessage(chatId, reply, MAIN_MENU_KEYBOARD);
      return;
    }

    sendChatAction(chatId, 'typing').catch(() => {});

    // =========================================================================
    // 2. Handle Photo messages
    // =========================================================================
    if (message.photo && message.photo.length > 0) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const caption = (message.caption || 'Please analyze this photo and let me know what Maru Metal Industry PLC can do for this.').trim();
      const imagePart = await downloadTelegramFileAsBase64(bestPhoto.file_id, 'image/jpeg');

      recordCustomerLog(chatId, senderName, username, 'Customer', `[Sent a photo] ${caption}`);

      let reply = await askAssistant(chatId, caption, imagePart, 'Sent a photo');

      if (reply.includes('[SHOW_CONTACT]')) {
        reply = reply.replace('[SHOW_CONTACT]', MARKETING_CONTACT_CARD).trim();
      }

      if (reply.includes('[ESCALATE_LEAD]')) {
        reply = `${reply.replace('[ESCALATE_LEAD]', '').trim()}\n\n${MARKETING_CONTACT_CARD}`;
        recordCustomerLog(chatId, senderName, username, 'Assistant', reply);
        const log = customerLogs.get(String(chatId));
        if (log) log.escalated = true;

        if (OWNER_ID) {
          const phoneStr = log?.phones?.length ? log.phones.join(', ') : 'Check transcript';
          const fullTranscript = log ? log.messages.join('\n') : caption;
          const alertText =
            `🚨 Maru Metal — Customer Photo Lead\n\n` +
            `👤 Customer: ${senderName} (${username})\n` +
            `🆔 Chat ID: ${chatId}\n` +
            `📞 Detected Phone: ${phoneStr}\n\n` +
            `💬 Full Conversation:\n${fullTranscript}`;
          await sendLongTelegramMessage(OWNER_ID, alertText);
        }
      } else {
        recordCustomerLog(chatId, senderName, username, 'Assistant', reply);
      }

      await sendTelegramMessage(chatId, reply, MAIN_MENU_KEYBOARD);
      return;
    }

    // =========================================================================
    // 3. Handle Text messages
    // =========================================================================
    const text = message.text.trim();
    recordCustomerLog(chatId, senderName, username, 'Customer', text);

    if (text === '/start' || text === '/menu') {
      chatHistory.delete(chatId);
      const welcomeMsg =
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ (Maru Metal Industry PLC) በደህና መጡ። ከ1967 ዓ.ም ጀምሮ ለ50 ዓመታት በጥራት ስናገለግል ቆይተናል።\n\n' +
        'Welcome to Maru Metal Industry PLC — celebrating 50 years of precision
