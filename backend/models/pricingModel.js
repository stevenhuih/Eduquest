const { pool } = require('../db');

async function getAll() {
  const result = await pool.query(
    'SELECT id, name, price, features, is_pro FROM pricing_plans ORDER BY price ASC'
  );
  return result.rows;
}

async function updateById(id, { name, price, features, is_pro }) {
  const result = await pool.query(
    `UPDATE pricing_plans
     SET name = COALESCE($2, name),
         price = COALESCE($3, price),
         features = COALESCE($4, features),
         is_pro = COALESCE($5, is_pro)
     WHERE id = $1
     RETURNING id, name, price, features, is_pro`,
    [id, name ?? null, price ?? null, features ?? null, is_pro ?? null]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, updateById };
