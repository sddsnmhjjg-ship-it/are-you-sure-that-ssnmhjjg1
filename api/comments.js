const fs = require('fs');
const os = require('os');
const path = require('path');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1509831789495980143/RyWpmIf5AWyRYuz1yXNktFxHtcFrW1gg8VR50fh6C9zug9Nb9keq38C4glpi2EkpvAQ_';
const STORE_PATH = path.join(os.tmpdir(), 'visitor-comments.json');
const MAX_COMMENTS = 50;

function readLocalComments() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw) || [];
    }
  } catch (err) {
    console.error('Read local comments error:', err);
  }
  return [];
}

function writeLocalComments(comments) {
  try {
    const trimmed = comments.slice(-MAX_COMMENTS);
    fs.writeFileSync(STORE_PATH, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    console.error('Write local comments error:', err);
  }
}

function normalizeMessage(m) {
  return {
    id: m.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author: m.author?.username || 'Visitor',
    content: m.content || '',
    timestamp: m.timestamp || new Date().toISOString()
  };
}

async function fetchDiscordComments(limit) {
  if (!WEBHOOK_URL) return null;
  const endpoint = `${WEBHOOK_URL}/messages?limit=${limit}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Discord fetch failed: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected Discord response');
  }
  return data.map(normalizeMessage).filter(c => c.content.trim());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const limit = Math.min(50, Number(req.query.limit || 20));
    let comments = [];

    try {
      comments = await fetchDiscordComments(limit);
    } catch (err) {
      console.warn('Discord comments fetch failed, falling back to local cache:', err.message);
      comments = readLocalComments().slice(-limit);
    }

    return res.status(200).json({ comments });
  }

  if (req.method === 'POST') {
    const body = req.body || (req.rawBody ? JSON.parse(req.rawBody.toString()) : {});
    const name = body.name ? String(body.name).trim().slice(0, 50) : 'Visitor';
    const comment = body.comment ? String(body.comment).trim().slice(0, 900) : '';

    if (!comment) {
      return res.status(400).json({ error: 'Missing comment text' });
    }

    const newComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: name || 'Visitor',
      content: comment,
      timestamp: new Date().toISOString()
    };

    try {
      if (WEBHOOK_URL) {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: newComment.author, content: newComment.content })
        });
      }
    } catch (err) {
      console.warn('Discord webhook failed, continuing with local cache:', err.message);
    }

    const comments = readLocalComments();
    comments.push(newComment);
    writeLocalComments(comments);

    return res.status(201).json({ comment: newComment });
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
};
