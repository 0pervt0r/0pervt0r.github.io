Deno.serve(async (req) => {
  const { record } = await req.json();

  const message = `
🛒 *Новый заказ!*
👤 Покупатель: \`${record.username}\`
📦 Товар: *${record.item_name}*
💰 Цена: ${record.item_price} крон
🕐 Время: ${new Date(record.created_at).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'})}
  `.trim();

  await fetch(`https://api.telegram.org/bot${Deno.env.get('TG_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Deno.env.get('TG_CHAT_ID'),
      text: message,
      parse_mode: 'Markdown'
    })
  });

  return new Response('ok');
});
