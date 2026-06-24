const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyUser } = require('../middlewares/authMiddleware');

const router = express.Router();

const getUserQuery = (id) => {
  const query = { $or: [{ id }] };
  if (ObjectId.isValid(id)) {
    query.$or.push({ _id: new ObjectId(id) });
  }
  return query;
};

// GET User Profile — AUTH REQUIRED
router.get('/profile', verifyUser, async (req, res) => {
  try {
    const user = await collections.users.findOne(getUserQuery(req.user.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Dashboard Stats — AUTH REQUIRED
router.get('/dashboard-stats', verifyUser, async (req, res) => {
  try {
    const user = await collections.users.findOne(getUserQuery(req.user.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalRecipes = await collections.recipes.countDocuments({ authorId: user.id });
    const totalFavorites = await collections.favorites.countDocuments({ userId: user.id });

    const userRecipes = await collections.recipes.find({ authorId: user.id }).toArray();
    const totalLikes = userRecipes.reduce((sum, r) => sum + (r.likesCount || 0), 0);

    const isPremium = user.isPremium === true || user.plan === 'premium';

    res.json({
      totalRecipes,
      totalFavorites,
      totalLikesReceived: totalLikes,
      isPremium,
      // Expose recipe limit info for frontend UI
      recipeLimit: isPremium || user.role === 'admin' ? null : 2,
      canAddMore: isPremium || user.role === 'admin' || totalRecipes < 2
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE User Profile — AUTH REQUIRED
router.put('/profile', verifyUser, async (req, res) => {
  try {
    const { name, image } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await collections.users.updateOne(
      getUserQuery(req.user.id),
      { $set: { name: name.trim(), image: image || '', updatedAt: new Date() } }
    );

    res.json({ message: 'Profile updated successfully', name: name.trim(), image });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
