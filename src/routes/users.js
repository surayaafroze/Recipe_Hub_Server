const express = require('express');
const { collections } = require('../../db');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// GET User Profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await collections.users.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Dashboard Stats
router.get('/dashboard-stats', verifyToken, async (req, res) => {
  try {
    const user = await collections.users.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalRecipes = await collections.recipes.countDocuments({ authorId: user.id });
    const totalFavorites = await collections.favorites.countDocuments({ userId: user.id });
    
    // Calculate total likes received on user's recipes
    const userRecipes = await collections.recipes.find({ authorId: user.id }).toArray();
    const totalLikes = userRecipes.reduce((sum, recipe) => sum + (recipe.likesCount || 0), 0);

    res.json({
      totalRecipes,
      totalFavorites,
      totalLikesReceived: totalLikes,
      isPremium: user.isPremium || user.plan === 'premium'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE User Profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, image } = req.body;
    await collections.users.updateOne(
      { id: req.user.id },
      { $set: { name, image, updatedAt: new Date() } }
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
