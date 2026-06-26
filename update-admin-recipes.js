const { connectDB, collections, client } = require('./db.js');

async function run() {
  await connectDB();
  
  // Find admin user
  const admin = await collections.users.findOne({ role: 'admin' });
  if (admin) {
    console.log("Found admin:", admin.name, admin._id);
  } else {
    console.log("No admin found. Creating one or just using string 'Admin'");
  }

  // Real users we know: Suraya Afroze, Evana Anjum
  const realUsers = ["Suraya Afroze", "Evana Anjum"];
  
  // Update all recipes NOT from realUsers to have Admin as author
  if (admin) {
    const result = await collections.recipes.updateMany(
      { authorName: { $nin: realUsers } },
      { $set: { authorId: admin._id.toString(), authorName: "Admin" } } // using admin's info
    );
    console.log(`Updated ${result.modifiedCount} recipes to Admin`);
  }

  await client.close();
}

run();
