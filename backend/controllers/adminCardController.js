const cardModel = require('../models/cardModel');

/**
 * GET /api/admin/cards - Returns all cards (admin).
 */
async function getAllCardsAdmin(req, res) {
  try {
    const cards = await cardModel.getAllCards();
    res.json({ success: true, cards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to load cards' });
  }
}

/**
 * POST /api/admin/cards - multipart/form-data: name, rarity_id, price, card_image (file)
 */
async function createCardAdmin(req, res) {
  try {
    const name = req.body.name != null ? String(req.body.name).trim() : '';
    const rarityId = req.body.rarity_id != null ? Number(req.body.rarity_id) : NaN;
    const price = Number(req.body.price);
    const file = req.file;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (isNaN(rarityId)) {
      return res.status(400).json({ success: false, error: 'rarity_id is required and must be valid' });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, error: 'price must be >= 0' });
    }
    if (!file || !file.filename) {
      return res.status(400).json({ success: false, error: 'card_image file is required' });
    }

    const card = await cardModel.createCard(name, rarityId, file.filename, price);
    if (!card) {
      return res.status(400).json({ success: false, error: 'Invalid rarity_id or failed to create card' });
    }
    res.status(201).json({ success: true, card });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create card' });
  }
}

/**
 * PUT /api/admin/cards/:id - Body: { name, price } (rarity/image unchanged)
 */
async function updateCardAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid card id' });
    }
    const name = req.body.name != null ? String(req.body.name).trim() : '';
    const price = Number(req.body.price);
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, error: 'price must be >= 0' });
    }
    const card = await cardModel.updateCard(id, name, price);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }
    res.json({ success: true, card });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update card' });
  }
}

/**
 * DELETE /api/admin/cards/:id
 */
async function deleteCardAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid card id' });
    }
    const deleted = await cardModel.deleteCard(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }
    res.json({ success: true, id: deleted.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete card' });
  }
}

module.exports = { getAllCardsAdmin, createCardAdmin, updateCardAdmin, deleteCardAdmin };
