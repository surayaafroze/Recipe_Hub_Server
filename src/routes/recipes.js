const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// GET all recipes (Pagination + Filtering)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Filtering by category using $in
    if (req.query.categories) {
      // e.g., ?categories=Breakfast,Lunch
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

// GET my recipes (Protected)
router.get('/my-recipes', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const recipes = await collections.recipes.find({ authorId: user.id }).sort({ createdAt: -1 }).toArray();
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET my purchased recipes (Protected)
router.get('/purchased', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Find all payment records for recipes by this user
    const payments = await collections.payments.find({ 
      userId: user.id, 
      recipeId: { $exists: true } 
    }).toArray();
    
    const purchasedRecipeIds = payments.map(p => new ObjectId(p.recipeId));
    
    if (purchasedRecipeIds.length === 0) {
      return res.json([]);
    }

    const recipes = await collections.recipes.find({ 
      _id: { $in: purchasedRecipeIds } 
    }).sort({ createdAt: -1 }).toArray();
    
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single recipe
router.get('/:id', async (req, res) => {
  try {
    const recipe = await collections.recipes.findOne({ _id: new ObjectId(req.params.id) });
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new recipe (Protected)
router.post('/', verifyToken, async (req, res) => {
  try {
    const user = req.user; // from JWT token payload
    
    // User Relation & Limit Check
    // If user is not premium and not admin, check if they already have 2 recipes
    if (user.plan !== 'premium' && user.plan !== 'pro' && user.role !== 'admin') {
      const userRecipeCount = await collections.recipes.countDocuments({ authorId: user.id });
      if (userRecipeCount >= 2) {
        return res.status(403).json({ error: 'Normal users can only add 2 recipes. Please upgrade to premium.' });
      }
    }

    const newRecipe = {
      ...req.body,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
      likesCount: 0,
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

// PUT update recipe (Protected, Author or Admin only)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const recipeId = new ObjectId(req.params.id);

    const existingRecipe = await collections.recipes.findOne({ _id: recipeId });
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    if (existingRecipe.authorId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this recipe' });
    }

    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id; // prevent _id overwrite
    delete updateData.authorId; // prevent changing author

    const result = await collections.recipes.updateOne(
      { _id: recipeId },
      { $set: updateData }
    );

    res.json({ message: 'Recipe updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE recipe (Protected, Author or Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const recipeId = new ObjectId(req.params.id);

    const existingRecipe = await collections.recipes.findOne({ _id: recipeId });
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    if (existingRecipe.authorId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this recipe' });
    }

    await collections.recipes.deleteOne({ _id: recipeId });
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH toggle feature recipe (Protected, Admin only)
router.patch('/:id/feature', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const recipeId = new ObjectId(req.params.id);
    const { isFeatured } = req.body;

    const result = await collections.recipes.updateOne(
      { _id: recipeId },
      { $set: { isFeatured } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json({ message: 'Recipe feature status updated', isFeatured });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH toggle like recipe (Protected)
router.patch('/:id/like', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const recipeId = new ObjectId(req.params.id);

    const recipe = await collections.recipes.findOne({ _id: recipeId });
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const likedBy = recipe.likedBy || [];
    const userIndex = likedBy.indexOf(user.id);

    let updateQuery;
    if (userIndex === -1) {
      // User hasn't liked it yet -> Add like
      updateQuery = {
        $push: { likedBy: user.id },
        $inc: { likesCount: 1 }
      };
    } else {
      // User already liked it -> Remove like
      updateQuery = {
        $pull: { likedBy: user.id },
        $inc: { likesCount: -1 }
      };
    }

    await collections.recipes.updateOne({ _id: recipeId }, updateQuery);
    
    res.json({ message: 'Like status toggled', liked: userIndex === -1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
