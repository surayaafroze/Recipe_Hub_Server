const { connectDB, collections, client } = require('./db.js');

// Strip all HTML tags and decode HTML entities
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<li>/gi, '\n• ')       // list items → bullet
    .replace(/<\/li>/gi, '')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')          // remove any remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')       // max 2 newlines
    .trim();
}

async function run() {
  await connectDB();
  const recipes = await collections.recipes.find({}).toArray();
  console.log(`Total recipes: ${recipes.length}`);

  let updatedCount = 0;
  for (const recipe of recipes) {
    const hasHtmlInstructions = /<[a-z][\s\S]*>/i.test(recipe.instructions || '');
    const hasHtmlIngredients = /<[a-z][\s\S]*>/i.test(recipe.ingredients || '');

    if (hasHtmlInstructions || hasHtmlIngredients) {
      const cleanInstructions = stripHtml(recipe.instructions);
      const cleanIngredients = stripHtml(recipe.ingredients);

      await collections.recipes.updateOne(
        { _id: recipe._id },
        { $set: { instructions: cleanInstructions, ingredients: cleanIngredients } }
      );

      console.log(`✅ Cleaned: "${recipe.recipeName}"`);
      updatedCount++;
    }
  }

  console.log(`\nDone! Updated ${updatedCount} recipes.`);
  await client.close();
}

run().catch(console.error);
