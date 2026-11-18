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

const SYSTEM_PROMPT = `You are the official bilingual (Amharic and English) AI sales and customer support assistant for Maru Metal Industry PLC (ማሩ ሜታል ኢንዱስትሪ ኃ.የተ.የግ.ማ) in Addis Ababa, Ethiopia ("Engineered for Reliability. Built for Africa").

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
1. Cold Chain Solutions:
   - Refrigerated Truck Bodies & Insulated Cold Boxes (custom-built for Isuzu NPR/FSR, SinoTruck, Fuso, and semi-trailers using high-grade polyurethane panels and stainless steel/GRP finishes).
   - Precision-Engineered Modular Cold Rooms & Walk-In Freezers/Chillers (for flowers, fresh produce, pharmaceuticals, dairy, and meat processing).
   - Transport refrigeration unit integration, routine maintenance, and genuine spare parts.
2. Automotive Body Structure & Trailers:
   - Heavy-duty cargo bodies, dry freight bodies, custom vehicle body building, and trailers (including MARU flatbed turntable 3-axle trailers with offset plateau).
3. Steel Structure & Industrial Engineering:
   - Custom steel structure fabrication and erection for warehouses, factories, and large-scale industrial infrastructure projects.
   - Industrial equipment installation and custom metal fabrication to exact engineering specifications.
4. Agriculture & Custom Manufacturing:
   - Agricultural equipment manufacturing and tailored industrial metal solutions.

IMAGE & PHOTO ANALYSIS RULE:
- When a customer sends a photo (such as a truck chassis, a cold room site, a trailer, a damaged part, or a technical drawing/sketch), carefully identify what is shown in the image and give helpful, practical engineering thoughts on how Maru Metal Industry PLC can build, repair, or customize a solution for it.
- If the image is unclear or you need exact measurements/chassis specs to give a quote, politely ask for those details along with their Name and Phone Number.

RULES:
- Reply in the exact language the customer uses (Amharic if they write in Amharic, English if they write in English).
- SPEED & BREVITY RULE: Keep answers direct, warm, and concise (2 to 4 sentences max unless listing divisions/contacts). Do not write long essays.
- FORMATTING RULE: Never use Markdown asterisks (** or *), hashtags (#), or raw formatting symbols. Write in clean plain text using simple line breaks or numbered lists (1., 2., 3.).
- Never invent specific prices, exact delivery timelines, or unverified specs.
- LEAD & QUOTE COLLECTION RULE: Whenever a customer asks for a price quote, custom dimensions/specs, site inspection, bulk order, or a human/manager:
  1. Check the conversation history—if they haven't shared their Name, Phone Number, and brief Project/Vehicle details yet, politely ask for those three details so our engineering/sales team can prepare an accurate quotation.
  2. Once they provide their contact/project details (or explicitly ask to speak to a human/sales manager), confirm that our sales engineering team will contact them shortly and include this exact hidden tag at the very end of your message: [ESCALATE_LEAD]`;

const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '❄️ Cold Chain & Trucks' }, { text: '🏗️ Steel Structures' }],
    [{ text: '🚛 Automotive & Trailers' }, { text: '📋 Request a Quote' }],
    [{ text: '📍 Location & Contact' }]
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
        'ሰላም! እንኳን ወደ ማሩ ሜታል ኢንዱስትሪ (Maru Metal Industry PLC) በደህና መጡ። ከ1967 ዓ.ም (1975) ጀምሮ ለ50 ዓመታት በጥራት ስናገለግል ቆይተናል።\n\nWelcome to Maru Metal Industry PLC — celebrating 50 years of precision engineering in Ethiopia! Choose a topic below, type your question, or send a photo of your truck/project in Amharic or English:',
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
