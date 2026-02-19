const cardModel = require('../models/cardModel');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/shop/rarities
 * Returns [{ id, name, color_class }] sorted by display_order.
 */
async function getRarities(req, res) {
  try {
    const rarities = await cardModel.getRarities();
    res.json(rarities);
  } catch (err) {
    console.error('Get rarities error:', err);
    res.status(500).json({ error: 'Failed to load rarities' });
  }
}

/**
 * GET /api/shop/card-image/:filename
 * Validate filename exists in DB, serve file from uploads/cards or legacy assets.
 */
async function getCardImage(req, res) {
  try {
    const raw = req.params.filename;
    const filename = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, '') || raw;
    if (!filename) {
      return res.status(400).json({ error: 'Filename required' });
    }
    const card = await cardModel.getCardByImageFilename(filename);
    if (!card || !card.image_path) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'cards');
    const projectRoot = path.join(__dirname, '..', '..');
    let filePath;
    if (card.image_path.indexOf('assets') !== -1 || card.image_path.indexOf('/') === 0) {
      const relative = card.image_path.replace(/^\//, '');
      filePath = path.join(projectRoot, relative);
    } else {
      filePath = path.join(uploadsDir, card.image_path);
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  } catch (err) {
    console.error('Get card image error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to serve image' });
  }
}

module.exports = { getRarities, getCardImage };
