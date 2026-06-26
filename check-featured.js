const { connectDB, collections, client } = require('./db.js');

async function run() {
  await connectDB();
  const recipes = await collections.recipes.find({}).toArray();
  console.log("Total recipes:", recipes.length);
  
  const featured = recipes.filter(r => r.isFeatured);
  console.log("Currently featured recipes:", featured.map(r => ({ id: r._id, name: r.recipeName, author: r.authorName })));
  
  const notFeatured = recipes.filter(r => !r.isFeatured);
  console.log("Not featured recipes:", notFeatured.map(r => ({ id: r._id, name: r.recipeName, author: r.authorName })));

  await client.close();
}

run();
