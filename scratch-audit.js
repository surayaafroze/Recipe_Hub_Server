require('dotenv').config();
const { MongoClient } = require('mongodb');

async function audit() {
  const client = new MongoClient(process.env.MONGO_DB_URI);
  try {
    await client.connect();
    // Use the database name from URI or we can check the list of databases
    // Let's just use the default DB from the URI. The URI might not have the DB name.
    // So let's connect to the DB we normally use.
    // Looking at auth.js, it uses process.env.AUTH_DB_NAME.
    // In backend, let's see how db.js connects.
    const dbName = 'Recipe_Hub'; // The user mentioned AUTH_DB_NAME=Recipe_Hub in previous prompt
    const db = client.db(dbName);

    const collections = await db.listCollections().toArray();
    console.log("Found Collections:", collections.map(c => c.name).sort());

    const targets = [
      'user', 'users',
      'account', 'accounts',
      'session', 'sessions',
      'verification', 'verifications',
      'jwk', 'jwks',
      'recipes', 'favorites', 'reports', 'payments'
    ];

    for (const name of targets) {
      if (collections.find(c => c.name === name)) {
        const count = await db.collection(name).countDocuments();
        console.log(`\nCollection: ${name} (Count: ${count})`);
        if (count > 0) {
          const sample = await db.collection(name).findOne({});
          console.log(`Sample:`, JSON.stringify(sample).substring(0, 300));
        }
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

audit();
