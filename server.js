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
- Use authentic Ethiopian Amharic phrasing and accurate Fidel spelling:
  * Cold room = ቀዝቃዛ መጋዘን
  * Walk-in freezer = የማቀዝቀዣ ክፍል / ዲፕ ፍሪዘር
  * Refrigerated truck = ፍሪጅ ያለው የጭነት መኪና
  * Steel structure = የብረት ግንባታ
  * Trailer / cargo body = ተሳቢ እና የጭነት አካል
  * Price quote / quotation = የዋጋ ዝርዝር / ኮቴሽን
  * Insulation panel = የሙቀት መከላከያ ፓነል
- Never produce awkward word-for-word machine translations. Write clearly and naturally.

FRIENDLY CONVERSATION & SMALL TALK RULE:
- Be warm, personable, and enjoyable to talk to. If customers bring up random everyday topics, jokes, weather, coffee, or casual banter, engage naturally with light humor like a real colleague, then gently keep the door open for any cold chain or steel project needs.

CONVERSATIONAL FLOW & GREETING RULE (STRICT):
- NEVER repeat "Welcome to Maru Metal Industry PLC", "ሰላም! እንኳን ደህና መጡ", or formal introductory greetings in ongoing replies.
- Jump straight into the conversation naturally. Only give a brief greeting if history is empty AND the customer just said "Hi", "Hello", or "ሰላም".

CRITICAL NEGATIVE CONSTRAINT:
- NEVER write phone numbers, email addresses, website URLs, street addresses, or staff names (including Luya Abebe) in your responses. The server handles contact cards automatically when needed.

COMPANY & PRODUCT KNOWLEDGE (Maru Metal Industry PLC — Est. 1975 by Dr. Maru Tefera, Addis Ababa, Akaki/Kality & Kera, KAIZEN & CAD engineering):
1. Stationary Cold Rooms (NEVER reveal third-party equipment brand names, origin countries, or OEM model codes—present strictly as Maru Metal Industry PLC solutions):
   - PIR/PU insulated panels (100 mm for chillers around 0 °C; 120–150 mm for freezers -20 °C to -30 °C), sanitary coving, hinged/sliding doors, shelving.
   - Ranges: High-temp work/processing rooms (+5 to +15 °C, 10–900+ m³), Medium-temp chillers (-5 to +10 °C, 3–2,700+ m³, including high-RH for produce/flowers), Deep freezers (-15 to -30 °C, 3–3,500+ m³), Blast freezing tunnels (-25 to -40 °C, 700–10,000 kg/day), Curing/drying & thawing chambers (500–5,000 kg).
   - Configurations: Compact wall/ceiling monoblocks (3–40 m³), centrifugal ducted indoor units (up to 10 m duct), silent splits, water/glycol-loop, and multi-chamber inverter systems. Rated up to +43 °C/+45 °C ambient, eco-friendly refrigerants (R-290, A2L, R-449A, R-452A), digital/PLC controls ("Jet Cool", intelligent defrost, voltage protection, optional remote HACCP logging).
   - Sizing: Ask for dimensions (L × W × H in m), target temp, and product (fruits/veg need ~1.5× factor).
2. Refrigerated Truck Bodies & Thermo King Units:
   - Custom insulated GRP/stainless bodies on Isuzu NPR/FSR, SinoTruck, Fuso, Hyundai, and semi-trailers equipped with THERMO KING units:
   - V-Series & B-Series (direct-drive for vans/light trucks like Isuzu NPR, 3–6.5 m box: V-100, V-200/220, V-300/320, V-500/520, V-800, B-100, E-200e, optional electric standby & Spectrum multi-temp).
   - T-Series / T-90 & UT-Series (self-powered diesel for medium/heavy trucks like Isuzu FSR, Fuso, SinoTruck, 5–9.5 m box: T-590, T-690, T-890, T-1090, T-1200R, UT-800/1200, down to -29 °C, up to +50 °C ambient).
   - SLXi & Precedent Series (semi-trailers 12–13.6 m: SLXi-300, SLXi-400, Precedent S-600/S-700/S-750i) + DSR/TSR-3 controllers & TracKing GPS telematics.
   - Sizing: Ask for truck model/chassis, box length, and target temp.
3. Trailers & Cargo Bodies: Heavy-duty cargo bodies, dry freight, and MARU flatbed turntable 3-axle trailers with offset plateau.
4. Steel Structures & Industrial Engineering: Custom steel structure fabrication/erection (warehouses, factories), industrial equipment installation, agricultural & custom metal works.

MEDIA, FORMATTING & ESCALATION RULES:
- Photos/Voice: Analyze photos practically; reply to voice notes naturally in the exact language spoken.
- Keep replies concise (2 to 4 sentences max unless listing specs). Plain text only—NEVER use Markdown asterisks (** or *), hashtags (#), or raw symbols. Never invent prices or lead times.
- If asked who they are talking to, who to contact, or for phone/email/human rep, output ONLY: [SHOW_CONTACT]
- For quotes/custom specs/inspections: Ask for Name, Phone Number, and Project/Vehicle details if not yet provided. Once provided, confirm our Marketing Department will follow up shortly and end with: [ESCALATE_LEAD]`;

const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '❄️ Cold Rooms' }, { text: '🚚 Cold Trucks (Thermo King)' }],
    [{ text: '🏗️ Steel Structures' }, { text: '🚛 Trailers & Cargo Bodies' }],
    [{ text: '📋 Request a Quote' }, { text: '📍 Location & Contact' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

function extractContactDetails(text) {
  const phones = text.match(/(?:\+251|0)?9\d{8}|\+?\d[\d\s-]{7,14}\d/g) || [];
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return {
    phones: [...new Set(phones.map((p) => p.trim()))],
    emails: [...new Set(emails.map((e) => e.trim()))]
  };
}

function recordCustomerLog(chatId, senderName, username, role, text) {
  const id = String(chatId);
  if (OWNER_ID && id === OWNER_ID) return;

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
  if (existing.messages.length > 30) existing.messages.shift();
  customerLogs.set(id, existing);
}

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
  // Uses the fast lite TTS model first for rapid voice delivery
  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
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

  // Fast lite model first for ~1-2s latency, with 3.8-flash fallback
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
          maxOutputTokens: 350
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
    // Private Owner Admin Commands
    if (isOwner && message.text) {
      const adminCmd = message.text.trim();

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

      if (adminCmd === '/clearleads') {
        customerLogs.clear();
        await sendTelegramMessage(chatId, 'All stored customer conversation logs have been cleared.');
        return;
      }
    }

    // 1. Handle Voice / Audio messages (sends text immediately, then voice note right after)
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

      // Send text right away so there's zero perceived lag, then send voice note
      await sendTelegramMessage(chatId, reply, MAIN_MENU_KEYBOARD);
      sendChatAction(chatId, 'record_voice').catch(() => {});
      const voiceAudio = await generateGeminiVoice(reply);
      if (voiceAudio) {
        await sendTelegramVoice(chatId, voiceAudio.buffer, voiceAudio.mimeType);
      }
      return;
    }

    sendChatAction(chatId, 'typing').catch(() => {});

    // 2. Handle Photo messages
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

    // 3. Handle Text messages
    const text = message.text.trim();
    recordCustomerLog(chatId, senderName, username, 'Customer', text);

    if (text === '/start' || text === '/menu') {
      chatHistory.delete(chatId);
      const welcomeMsg =
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ (Maru Metal Industry PLC) በደህና መጡ። ከ1967 ዓ.ም ጀምሮ ለ50 ዓመታት በጥራት ስናገለግል ቆይተናል።\n\n' +
        'Welcome to Maru Metal Industry PLC — celebrating 50 years of precision engineering in Ethiopia! Choose a topic below, chat with me anytime, send a voice note, or share a photo in Amharic or English:';
      saveBotReply(chatId, welcomeMsg);
      recordCustomerLog(chatId, senderName, username, 'Assistant', welcomeMsg);
      await sendTelegramMessage(chatId, welcomeMsg, MAIN_MENU_KEYBOARD);
      return;
    }

    if (text === '📍 Location & Contact') {
      const contactMsg =
        'Maru Metal Industry PLC — Addis Ababa, Ethiopia\n\n' +
        'Marketing Contact: Luya Abebe (Marketing Department)\n' +
        'Direct Phone: +251 911 858 889\n' +
        'Direct Email: luyaabebe@maruplc.com\n\n' +
        'Address: Woreda 05, Akaki/Kality Subcity (Facilities in Akaki/Kality & Kera)\n' +
        'Working Hours: 09:00 AM – 05:00 PM\n' +
        'Office Lines: +251 11 437 59 73 | +251 11 439 82 54 | +251 11 462 43 10 | +251 99 359 79 28\n' +
        'General Email: info@maruplc.com\n' +
        'Website: www.maruplc.com';
      recordCustomerLog(chatId, senderName, username, 'Assistant', contactMsg);
      await sendTelegramMessage(chatId, contactMsg, MAIN_MENU_KEYBOARD);
      return;
    }

    let reply = await askAssistant(chatId, text);

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
        const fullTranscript = log ? log.messages.join('\n') : text;
        const alertText =
          `🚨 Maru Metal — New Customer Lead\n\n` +
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
  } catch (err) {
    console.error('Webhook processing error:', err);
    await sendTelegramMessage(
      chatId,
      'ይቅርታ፣ ሲስተሙ ላይ ትንሽ መቆራረጥ አጋጥሟል። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።\n\nSorry, there was a temporary connection issue. Please try again shortly.'
    );
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Maru Metal Industry PLC Assistant Server Live');
});
