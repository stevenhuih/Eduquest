const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'landing-content.json');

const DEFAULT_CONTENT = {
  hero: {
    title: 'Make Learning An Adventure',
    subtitle: 'Engage students with gamified quests, track progress in real-time, and build a classroom culture that celebrates every achievement.'
  },
  features: [
    { title: 'Track Progress', description: 'Visualize student mastery in real-time. Identify gaps and celebrate growth streaks.' },
    { title: 'Run Challenges', description: 'Create epic boss battles (exams) and daily quests. Turn "have to do" into "want to conquer".' },
    { title: 'Boost Motivation', description: 'Unlock avatars, earn badges, and build a positive classroom culture where effort is the currency.' },
    { title: 'Team Battles', description: 'Form guilds and collaborative groups. Students learn faster when they are winning together.' }
  ],
  pricing: [
    { name: 'Basic Plan', description: 'Suitable for small tuition centers', limitLabel: 'Up to 5 classes' },
    { name: 'Pro Plan', description: 'Unlimited classes and analytics', limitLabel: 'Unlimited classes' }
  ]
};

function readContent() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      hero: data.hero && typeof data.hero === 'object' ? data.hero : DEFAULT_CONTENT.hero,
      features: Array.isArray(data.features) ? data.features : DEFAULT_CONTENT.features,
      pricing: Array.isArray(data.pricing) ? data.pricing : DEFAULT_CONTENT.pricing
    };
  } catch (err) {
    if (err.code === 'ENOENT') return DEFAULT_CONTENT;
    console.error('Content read error:', err);
    return DEFAULT_CONTENT;
  }
}

function getLanding(req, res) {
  try {
    const content = readContent();
    res.json(content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load content' });
  }
}

function putLanding(req, res) {
  try {
    const body = req.body || {};
    const current = readContent();
    const content = {
      hero: body.hero && typeof body.hero === 'object' ? body.hero : current.hero,
      features: Array.isArray(body.features) ? body.features : current.features,
      pricing: Array.isArray(body.pricing) ? body.pricing : current.pricing
    };
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(content, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to save content' });
  }
}

module.exports = { getLanding, putLanding };
