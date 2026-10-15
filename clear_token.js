const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const targetUser = process.argv[2] || 'tiwariaman9528';

(async () => {
  try {
    const db = await open({ filename: './esp_database.sqlite', driver: sqlite3.Database });
    const user = await db.get(
      'SELECT id, username, email FROM users WHERE username = ? OR email LIKE ?',
      [targetUser, `%${targetUser}%`]
    );

    if (!user) {
      console.log(`User "${targetUser}" was not found in the database.`);
      const allUsers = await db.all('SELECT id, username, email FROM users');
      console.log('Existing users in database:', allUsers);
      await db.close();
      return;
    }

    await db.run(
      `UPDATE broker_credentials 
       SET fyers_access_token = NULL, dhan_access_token = NULL, 
           fyers_token_generated_at = NULL, dhan_token_generated_at = NULL, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [user.id]
    );

    console.log(`Successfully deleted all access tokens for: ${user.username} (User ID: ${user.id})`);
    await db.close();
  } catch (err) {
    console.error('Error clearing token:', err.message);
  }
})();
