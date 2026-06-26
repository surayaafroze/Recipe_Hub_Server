require('dotenv').config();
const { MongoClient } = require('mongodb');

async function migrate() {
  const client = new MongoClient(process.env.MONGO_DB_URI);
  try {
    await client.connect();
    const db = client.db('Recipe_Hub');

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log("==========================================");
    console.log("1. PRE-MIGRATION AUDIT");
    console.log("==========================================\n");

    const pairs = [
      { from: 'user', to: 'users' },
      { from: 'account', to: 'accounts' },
      { from: 'session', to: 'sessions' },
      { from: 'verification', to: 'verifications' },
      { from: 'jwk', to: 'jwks' },
      { from: 'jwkss', to: 'jwks' } // additional cleanup based on earlier findings
    ];

    const stats = {};
    for (const pair of pairs) {
      if (!stats[pair.from]) stats[pair.from] = { name: pair.from, count: 0, exists: false };
      if (!stats[pair.to]) stats[pair.to] = { name: pair.to, count: 0, exists: false };
      
      if (collectionNames.includes(pair.from)) {
        stats[pair.from].exists = true;
        stats[pair.from].count = await db.collection(pair.from).countDocuments();
      }
      if (collectionNames.includes(pair.to)) {
        stats[pair.to].exists = true;
        stats[pair.to].count = await db.collection(pair.to).countDocuments();
      }
    }

    for (const key in stats) {
      const s = stats[key];
      const isPlural = s.name.endsWith('s') && s.name !== 'jwkss';
      console.log(`Collection: ${s.name}`);
      console.log(`  - Document Count: ${s.count}`);
      console.log(`  - Referenced in App Code: ${isPlural ? 'Yes' : 'No'}`);
      console.log(`  - Used by Better Auth (usePlural=true): ${isPlural ? 'Yes' : 'No'}`);
    }

    console.log("\n==========================================");
    console.log("2. MIGRATION");
    console.log("==========================================\n");

    const migrationResults = [];

    for (const pair of pairs) {
      if (!collectionNames.includes(pair.from)) continue;
      
      const sourceDocs = await db.collection(pair.from).find({}).toArray();
      let migratedCount = 0;
      let skippedCount = 0;

      for (const doc of sourceDocs) {
        // Attempt to find if it exists in the destination
        const existing = await db.collection(pair.to).findOne({ _id: doc._id });
        
        if (!existing) {
          // If not exists, insert it
          await db.collection(pair.to).insertOne(doc);
          migratedCount++;
        } else {
          // If it exists, skip to prevent overwriting current active data
          skippedCount++;
        }
      }
      
      console.log(`Migrating ${pair.from} -> ${pair.to}:`);
      console.log(`  - Migrated (New): ${migratedCount}`);
      console.log(`  - Skipped (Already Exists): ${skippedCount}`);
      
      migrationResults.push({
        from: pair.from,
        to: pair.to,
        migrated: migratedCount,
        skipped: skippedCount
      });
    }

    console.log("\n==========================================");
    console.log("3. CLEANUP");
    console.log("==========================================\n");

    const dropped = [];
    for (const pair of pairs) {
      if (collectionNames.includes(pair.from)) {
        await db.collection(pair.from).drop();
        console.log(`Dropped obsolete collection: ${pair.from}`);
        dropped.push(pair.from);
      }
    }

    console.log("\n==========================================");
    console.log("4. POST-MIGRATION AUDIT");
    console.log("==========================================\n");

    const postCollections = await db.listCollections().toArray();
    const postNames = postCollections.map(c => c.name).sort();
    
    console.log("Final Database Collections:");
    for (const name of postNames) {
      const count = await db.collection(name).countDocuments();
      console.log(`- ${name} (Count: ${count})`);
    }

  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await client.close();
  }
}

migrate();
