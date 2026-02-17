// Vercel Serverless Function — Persistent Leaderboard via Edge Config

var EC_ID = process.env.EDGE_CONFIG_ID;
var API_TOKEN = process.env.VERCEL_API_TOKEN;
var EC_URL = process.env.EDGE_CONFIG;
var MAX_SCORES = 50;
var VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme', 'crazy', 'endless'];

function getDifficulty(req) {
  var d = ((req.query && req.query.difficulty) || (req.body && req.body.difficulty) || 'easy').toLowerCase();
  return VALID_DIFFICULTIES.indexOf(d) >= 0 ? d : 'easy';
}

async function readScores(difficulty) {
  try {
    // EC_URL format: https://edge-config.vercel.com/ecfg_xxx?token=yyy
    var parts = EC_URL.split('?');
    var url = parts[0] + '/item/scores_' + difficulty + '?' + parts[1];
    var res = await fetch(url);
    if (!res.ok) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('readScores error:', e.message);
    return [];
  }
}

async function writeScores(difficulty, scores) {
  var url = 'https://api.vercel.com/v1/edge-config/' + EC_ID + '/items';
  var res = await fetch(url, {
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
    var err = await res.text();
    console.error('writeScores error:', res.status, err);
    throw new Error('Edge Config write failed: ' + res.status);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Debug: log env var presence
  console.log('ENV CHECK - EC_ID:', !!EC_ID, 'API_TOKEN:', !!API_TOKEN, 'EC_URL:', !!EC_URL);

  if (!EC_ID || !API_TOKEN || !EC_URL) {
    return res.status(500).json({ 
      error: 'Missing env vars',
      has_EC_ID: !!EC_ID,
      has_API_TOKEN: !!API_TOKEN, 
      has_EC_URL: !!EC_URL
    });
  }

  var difficulty = getDifficulty(req);

  try {
    if (req.method === 'GET') {
      var scores = await readScores(difficulty);
      var top = scores.sort(function(a, b) { return b.score - a.score; }).slice(0, 10);
      return res.status(200).json({ scores: top, difficulty: difficulty });
    }

    if (req.method === 'POST') {
      var body = req.body || {};
      var name = body.name;
      var score = body.score;
      if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Need name and score' });
      }
      var clean = String(name).slice(0, 20).replace(/[<>]/g, '');
      var now = new Date();
      var date = (now.getMonth() + 1) + '/' + now.getDate();

      var allScores = await readScores(difficulty);
      allScores.push({ name: clean, score: score, date: date });
      allScores.sort(function(a, b) { return b.score - a.score; });
      allScores = allScores.slice(0, MAX_SCORES);

      await writeScores(difficulty, allScores);

      var top = allScores.slice(0, 10);
      return res.status(200).json({ scores: top, difficulty: difficulty });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: 'Internal error: ' + e.message });
  }
};
