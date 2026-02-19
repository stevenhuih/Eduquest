/**
 * Centralized reward logic: XP curve, level-up coins, and applying rewards to a student in a class.
 * Level is derived from class XP (student_class_progress). Coins live on students table.
 */

function xpRequiredForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function levelUpCoins(level) {
  return 20 + level * 5;
}

/**
 * Get level from total class XP using non-linear curve.
 * Level 1: 0 XP, level 2: 100 XP, level 3: 282 XP, etc.
 */
function levelFromXP(xp) {
  const total = Number(xp) || 0;
  let level = 1;
  while (total >= xpRequiredForLevel(level)) {
    level++;
  }
  return level;
}

/**
 * Apply XP and coins to a student in a class.
 * 1. Add XP to student_class_progress (ensures row exists)
 * 2. Compute level before and after
 * 3. Add level-up coins for each level gained
 * 4. Add (coinGained + level-up coins) to students.coins
 * @param {number} studentId
 * @param {number} classId
 * @param {number} xpGained
 * @param {number} coinGained
 * @param {object} db - pool from require('../db')
 * @returns {Promise<{ xpAdded: number, coinsAdded: number, leveledUp: boolean, newLevel: number }>}
 */
async function applyRewards(studentId, classId, xpGained, coinGained, db) {
  const xp = Number(xpGained) || 0;
  const coins = Number(coinGained) || 0;

  // Ensure progress row exists
  await db.query(
    `INSERT INTO student_class_progress (student_id, class_id, xp, streak, last_activity)
     VALUES ($1, $2, 0, 0, NULL)
     ON CONFLICT (student_id, class_id) DO NOTHING`,
    [studentId, classId]
  );

  const progressRes = await db.query(
    'SELECT xp FROM student_class_progress WHERE student_id = $1 AND class_id = $2',
    [studentId, classId]
  );
  const currentXP = progressRes.rows[0] ? (Number(progressRes.rows[0].xp) || 0) : 0;
  const levelBefore = levelFromXP(currentXP);
  const newXP = currentXP + xp;
  const levelAfter = levelFromXP(newXP);

  await db.query(
    'UPDATE student_class_progress SET xp = xp + $1 WHERE student_id = $2 AND class_id = $3',
    [xp, studentId, classId]
  );

  let levelUpCoinsTotal = 0;
  for (let L = levelBefore + 1; L <= levelAfter; L++) {
    levelUpCoinsTotal += levelUpCoins(L);
  }
  const totalCoinsToAdd = coins + levelUpCoinsTotal;

  if (totalCoinsToAdd > 0) {
    await db.query(
      'UPDATE students SET coins = coins + $1 WHERE id = $2',
      [totalCoinsToAdd, studentId]
    );
  }

  return {
    xpAdded: xp,
    coinsAdded: totalCoinsToAdd,
    leveledUp: levelAfter > levelBefore,
    newLevel: levelAfter,
  };
}

module.exports = {
  xpRequiredForLevel,
  levelUpCoins,
  levelFromXP,
  applyRewards,
};
