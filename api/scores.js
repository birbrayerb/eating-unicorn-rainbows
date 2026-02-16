// Vercel Serverless Function — Global Leaderboard
// Scores persist across warm invocations (resets on cold start, which is fine for a kids game)

let scores = [];
const MAX_SCORES = 50;

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Return top 10
    const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 10);
    return res.status(200).json({ scores: top });
  }

  if (req.method === 'POST') {
    const { name, score } = req.body || {};
    if (!name || typeof score !== 'number') {
      return res.status(400).json({ error: 'Need name and score' });
    }
    const clean = String(name).slice(0, 20).replace(/[<>]/g, '');
    const now = new Date();
    const date = `${now.getMonth() + 1}/${now.getDate()}`;
    scores.push({ name: clean, score, date });
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > MAX_SCORES) scores = scores.slice(0, MAX_SCORES);
    const top = scores.slice(0, 10);
    return res.status(200).json({ scores: top });
  }

  return res.status(405).end();
}
