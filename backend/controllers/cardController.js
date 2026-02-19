const cardModel = require('../models/cardModel');
const studentModel = require('../models/studentModel');

/**
 * GET /api/cards
 * Returns all cards.
 */
async function getCards(req, res) {
  try {
    const cards = await cardModel.getAllCards();
    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load cards' });
  }
}

/**
 * POST /api/cards/buy
 * Body: { cardId }. Student identity from x-student-id header only.
 */
async function buyCard(req, res) {
  try {
    const studentId = Number(req.headers['x-student-id']);
    if (studentId == null || isNaN(studentId)) {
      return res.status(401).json({ error: 'x-student-id header is required' });
    }
    const cardId = req.body.cardId != null ? Number(req.body.cardId) : null;
    if (!cardId) {
      return res.status(400).json({ error: 'cardId is required' });
    }
    const card = await cardModel.getCardById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const price = Number(card.price) || 0;
    const coins = await studentModel.getCoins(studentId);
    if (coins == null || coins < price) {
      return res.status(400).json({ error: 'Not enough coins' });
    }
    const newBalance = await studentModel.deductCoins(studentId, price);
    if (newBalance == null) {
      return res.status(400).json({ error: 'Not enough coins' });
    }
    await cardModel.addStudentCard(studentId, cardId);
    res.json({ coins: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
}

module.exports = { getCards, buyCard };
