const pricingModel = require('../models/pricingModel');

async function getPricing(req, res) {
  try {
    const plans = await pricingModel.getAll();
    res.json(plans);
  } catch (err) {
    console.error('GET /api/pricing error:', err);
    res.status(500).json({ error: 'Failed to load pricing plans' });
  }
}

async function putPricing(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid plan id' });
    }
    const body = req.body || {};
    const name = body.name != null ? String(body.name).trim() : null;
    const price = body.price != null ? parseInt(body.price, 10) : null;
    let features = body.features;
    if (features != null && !Array.isArray(features)) {
      features = typeof features === 'string' ? features.split(',').map(s => s.trim()).filter(Boolean) : null;
    }
    const is_pro = body.is_pro != null ? Boolean(body.is_pro) : null;

    const updated = await pricingModel.updateById(id, { name, price, features, is_pro });
    if (!updated) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/pricing/:id error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
}

module.exports = { getPricing, putPricing };
