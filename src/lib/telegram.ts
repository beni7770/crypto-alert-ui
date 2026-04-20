const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("חסר VITE_TELEGRAM_BOT_TOKEN בקובץ .env");
  }

  if (!TELEGRAM_CHAT_ID) {
    throw new Error("חסר VITE_TELEGRAM_CHAT_ID בקובץ .env");
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram error ${res.status}: ${text}`);
  }
}