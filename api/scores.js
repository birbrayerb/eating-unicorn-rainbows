// Vercel Serverless Function — Persistent Leaderboard via Edge Config

const EC_ID = process.env.EDGE_CONFIG_ID;
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const EC_URL = process.env.EDGE_CONFIG;
const MAX_SCORES = 50;
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme', 'crazy', 'endless'];

function getDifficulty(req) {
  const d = (req.query && req.query.difficulty || req.body && req.body.difficulty || 'easy').toLowerCase();
  return VALID_DIFFICULTIES.includes(d) ? d : 'easy';
}

async function readScores(difficulty) {
  try {
    const base = EC_URL.split('?')[0];
    const token = EC_URL.split('token=')[1];
    const res = await fetch(base + '/item/scores_' + difficulty + '?token=' + token);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('readScores error:', e);
    return [];
  }
}

async function writeScores(difficulty, scores) {
  const res = await fetch('https://api.vercel.com/v1/edge-config/' + EC_ID + '/items', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + API_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key: 'scores_' + difficulty, value: scores }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('writeScores error:', res.status, err);
    throw new Error('Edge Config write failed: ' + res.status);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const difficulty = getDifficulty(req);

  try {
    if (req.method === 'GET') {
      const scores = await readScores(difficulty);
      const top = scores.sort(function(a, b) { return b.score - a.score; }).slice(0, 10);
      return res.status(200).json({ scores: top, difficulty: difficulty });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const name = body.name;
      const score = body.score;
      if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Need name and score' });
      }
      var clean = String(name).slice(0, 20).replace(/[<>]/g, '');
      var now = new Date();
      var date = (now.getMonth() + 1) + '/' + now.getDate();

      var scores = await readScores(difficulty);
      scores.push({ name: clean, score: score, date: date });
      scores.sort(function(a, b) { return b.score - a.score; });
      scores = scores.slice(0, MAX_SCORES);

      await writeScores(difficulty, scores);

      var top = scores.slice(0, 10);
      return res.status(200).json({ scores: top, difficulty: difficulty });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
