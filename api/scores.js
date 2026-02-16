// Vercel Serverless Function — Global Leaderboard (per-difficulty)
// Scores persist across warm invocations (resets on cold start, which is fine for a kids game)

let scoresByDifficulty = {
  easy: [],
  medium: [],
  hard: [],
  extreme: [],
  crazy: [],
  endless: [],
};
const MAX_SCORES = 50;
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme', 'crazy', 'endless'];

function getDifficulty(req) {
  const d = (req.query?.difficulty || req.body?.difficulty || 'easy').toLowerCase();
  return VALID_DIFFICULTIES.includes(d) ? d : 'easy';
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const difficulty = getDifficulty(req);
  let scores = scoresByDifficulty[difficulty];

  if (req.method === 'GET') {
    const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 10);
    return res.status(200).json({ scores: top, difficulty });
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
    if (scores.length > MAX_SCORES) scoresByDifficulty[difficulty] = scores.slice(0, MAX_SCORES);
    const top = scores.slice(0, 10);
    return res.status(200).json({ scores: top, difficulty });
  }

  return res.status(405).end();
}
