const TELEGRAM_API = 'https://api.telegram.org';

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return token;
}

export async function sendMessage(chatId: number | string, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function sendChatAction(chatId: number | string, action: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken()}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export async function sendDocument(chatId: number | string, filename: string, content: string, caption?: string): Promise<void> {
  const form = new FormData();
  form.set('chat_id', String(chatId));
  if (caption) form.set('caption', caption);
  form.set('document', new Blob([content], { type: 'text/markdown' }), filename);
  await fetch(`${TELEGRAM_API}/bot${botToken()}/sendDocument`, {
    method: 'POST',
    body: form,
  });
}
