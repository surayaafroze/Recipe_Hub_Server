const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyUser, requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

// GET all recipes (Pagination + Filtering) — PUBLIC
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.categories) {
      const categoriesArray = req.query.categories.split(',');
      query.category = { $in: categoriesArray };
    }

    const recipes = await collections.recipes
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .toArray();

    const total = await collections.recipes.countDocuments(query);

    res.json({
      recipes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecipes: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET featured recipes — PUBLIC
router.get('/featured', async (req, res) => {
  try {
    const recipes = await collections.recipes.find({ isFeatured: true }).limit(6).toArray();
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET popular recipes — PUBLIC
router.get('/popular', async (req, res) => {
  try {
    const recipes = await collections.recipes.find({}).sort({ likesCount: -1 }).limit(6).toArray();
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Protected User Routes ────────────────────────────────────────────────────

// GET my recipes — AUTH REQUIRED
router.get('/my-recipes', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const recipes = await collections.recipes.find({ authorId: user.id }).sort({ createdAt: -1 }).toArray();
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET purchased recipes — AUTH REQUIRED
router.get('/purchased', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const payments = await collections.payments.find({
      userId: user.id,
      recipeId: { $exists: true }
    }).toArray();

    const purchasedRecipeIds = payments.map(p => new ObjectId(p.recipeId));
    if (purchasedRecipeIds.length === 0) return res.json([]);

    const recipes = await collections.recipes.find({
      _id: { $in: purchasedRecipeIds }
    }).sort({ createdAt: -1 }).toArray();

    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single recipe — PUBLIC
router.get('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid recipe ID format' });
    }
    const recipe = await collections.recipes.findOne({ _id: new ObjectId(req.params.id) });
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create recipe — AUTH REQUIRED (max 2 for normal users)
router.post('/', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const isPremium = user.isPremium === true || user.plan === 'premium';

    // Enforce 2-recipe limit for non-premium, non-admin users
    if (!isPremium && user.role !== 'admin') {
      const userRecipeCount = await collections.recipes.countDocuments({ authorId: user.id });
      if (userRecipeCount >= 2) {
        return res.status(403).json({
          error: 'Recipe limit reached. Normal users can only add 2 recipes. Upgrade to Premium for unlimited access.'
        });
      }
    }

    const newRecipe = {
      ...req.body,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
      likesCount: 0,
      likedBy: [],
      status: 'active',
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collections.recipes.insertOne(newRecipe);
    res.status(201).json({ _id: result.insertedId, ...newRecipe });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update recipe — AUTH REQUIRED (own recipes or admin)
router.put('/:id', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid recipe ID' });
    const recipeId = new ObjectId(req.params.id);

    const existingRecipe = await collections.recipes.findOne({ _id: recipeId });
    if (!existingRecipe) return res.status(404).json({ error: 'Recipe not found' });

    if (existingRecipe.authorId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this recipe' });
    }

    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;
    delete updateData.authorId;

    await collections.recipes.updateOne({ _id: recipeId }, { $set: updateData });
    res.json({ message: 'Recipe updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE recipe — AUTH REQUIRED (own recipes or admin)
router.delete('/:id', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid recipe ID' });
    const recipeId = new ObjectId(req.params.id);

    const existingRecipe = await collections.recipes.findOne({ _id: recipeId });
    if (!existingRecipe) return res.status(404).json({ error: 'Recipe not found' });

    if (existingRecipe.authorId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this recipe' });
    }

    await collections.recipes.deleteOne({ _id: recipeId });
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH feature recipe — ADMIN ONLY
router.patch('/:id/feature', requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid recipe ID' });
    const recipeId = new ObjectId(req.params.id);
    const { isFeatured } = req.body;

    const result = await collections.recipes.updateOne(
      { _id: recipeId },
      { $set: { isFeatured } }
    );

    if (result.matchedCount === 0) return res.status(404).json({ error: 'Recipe not found' });
    res.json({ message: 'Recipe feature status updated', isFeatured });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH toggle like — AUTH REQUIRED
router.patch('/:id/like', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid recipe ID' });
    const recipeId = new ObjectId(req.params.id);

    const recipe = await collections.recipes.findOne({ _id: recipeId });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const likedBy = recipe.likedBy || [];
    const userIndex = likedBy.indexOf(user.id);

    let updateQuery;
    if (userIndex === -1) {
      updateQuery = { $push: { likedBy: user.id }, $inc: { likesCount: 1 } };
    } else {
      updateQuery = { $pull: { likedBy: user.id }, $inc: { likesCount: -1 } };
    }

    await collections.recipes.updateOne({ _id: recipeId }, updateQuery);
    res.json({ message: 'Like status toggled', liked: userIndex === -1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
