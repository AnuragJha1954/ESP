const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const target = process.argv[2] || '12';

(async () => {
  try {
    const db = await open({ filename: './esp_database.sqlite', driver: sqlite3.Database });
    let userId = null;

    if (!isNaN(target)) {
      userId = parseInt(target, 10);
    } else {
      const user = await db.get(
        'SELECT id, username FROM users WHERE username = ? OR email LIKE ?',
        [target, `%${target}%`]
      );
      if (user) userId = user.id;
    }

    if (!userId) {
      console.log(`User "${target}" was not found in the database.`);
      await db.close();
      return;
    }

    const cols = (await db.all('PRAGMA table_info(broker_credentials)')).map(c => c.name);
    const updates = [];
    if (cols.includes('fyers_access_token')) updates.push('fyers_access_token = NULL');
    if (cols.includes('dhan_access_token')) updates.push('dhan_access_token = NULL');
    if (cols.includes('fyers_token_generated_at')) updates.push('fyers_token_generated_at = NULL');
    if (cols.includes('dhan_token_generated_at')) updates.push('dhan_token_generated_at = NULL');
    if (cols.includes('updated_at')) updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length > 0) {
      await db.run(`UPDATE broker_credentials SET ${updates.join(', ')} WHERE user_id = ?`, [userId]);
    }

    console.log(`Successfully deleted access token for User ID: ${userId}`);
    await db.close();
  } catch (err) {
    console.error('Error clearing token:', err.message);
  }
})();
