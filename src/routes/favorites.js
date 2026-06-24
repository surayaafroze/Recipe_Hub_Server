const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyUser } = require('../middlewares/authMiddleware');

const router = express.Router();

// Add to favorites
router.post('/', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const { recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: 'recipeId is required' });
    }

    // Check if recipe exists
    const recipe = await collections.recipes.findOne({ _id: new ObjectId(recipeId) });
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Check if already in favorites
    const existingFav = await collections.favorites.findOne({ 
      userId: user.id, 
      recipeId: recipeId 
    });

    if (existingFav) {
      return res.status(400).json({ error: 'Recipe already in favorites' });
    }

    const newFavorite = {
      userId: user.id,
      userEmail: user.email,
      recipeId: recipeId,
      addedAt: new Date()
    };

    const result = await collections.favorites.insertOne(newFavorite);
    res.status(201).json({ message: 'Added to favorites', favoriteId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from favorites
router.delete('/:recipeId', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const recipeId = req.params.recipeId;

    const result = await collections.favorites.deleteOne({ 
      userId: user.id, 
      recipeId: recipeId 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user favorites
router.get('/', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    
    // Find favorite entries
    const favorites = await collections.favorites.find({ userId: user.id }).toArray();
    
    if (favorites.length === 0) {
      return res.json([]);
    }

    // Extract recipe IDs
    const recipeIds = favorites.map(fav => {
      try {
        return new ObjectId(fav.recipeId);
      } catch(e) {
         // handle invalid objectids just in case
        return null;
      }
    }).filter(id => id !== null);

    // Fetch corresponding recipes
    const favoriteRecipes = await collections.recipes.find({ 
      _id: { $in: recipeIds } 
    }).toArray();

    // Map the addedAt date
    const response = favoriteRecipes.map(recipe => {
      const favInfo = favorites.find(f => f.recipeId === recipe._id.toString());
      return {
        ...recipe,
        favoritedAt: favInfo ? favInfo.addedAt : null,
        isFavorited: true // Explicitly set for frontend convenience
      };
    });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
