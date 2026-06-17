// Vercel Serverless — Check Order Status
// Reads the Discord webhook message to return current order status

module.exports = async (req, res) => {
  // Allow CORS for browser polling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { mid } = req.query;

  if (!mid) {
    return res.status(400).json({ error: 'Missing message ID (mid)' });
  }

  const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1509831789495980143/RyWpmIf5AWyRYuz1yXNktFxHtcFrW1gg8VR50fh6C9zug9Nb9keq38C4glpi2EkpvAQ_';

  try {
    const getRes = await fetch(`${WEBHOOK_URL}/messages/${mid}`);
    if (!getRes.ok) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = await getRes.json();
    const embed = msg.embeds && msg.embeds[0];

    if (!embed) {
      return res.status(400).json({ error: 'No embed in message' });
    }

    // Find the status field
    const statusField = embed.fields.find(f => f.name.includes('Order Status') || f.name.includes('Status'));
    
    let status = 'pending';
    if (statusField) {
      const val = statusField.value.toUpperCase();
      if (val.includes('COOKING')) status = 'cooking';
      else if (val.includes('DONE') || val.includes('READY')) status = 'done';
      else if (val.includes('CANCEL')) status = 'cancel';
      else if (val.includes('PENDING')) status = 'pending';
    }

    return res.status(200).json({ 
      status,
      title: embed.title || '',
      color: embed.color || 0,
      timestamp: embed.timestamp || null
    });

  } catch (err) {
    console.error('Check-status error:', err);
    return res.status(500).json({ error: 'Failed to check order status' });
  }
};
