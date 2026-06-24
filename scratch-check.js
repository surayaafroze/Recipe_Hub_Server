const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_DB_URI);

async function run() {
  try {
    await client.connect();
    const db = client.db("Recipe_Hub");
    
    const users = await db.collection("users").find({}).toArray();
    console.log("All users in Recipe_Hub.users:");
    users.forEach(u => {
      console.log(`- Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, isPremium: ${u.isPremium}, plan: ${u.plan}, id: ${u.id || u._id}`);
    });

    const payments = await db.collection("payments").find({}).toArray();
    console.log("\nAll payments in Recipe_Hub.payments:");
    payments.forEach(p => {
      console.log(`- Email: ${p.userEmail}, Amount: ${p.amount}, Type: ${p.type}, Date: ${p.paidAt}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
