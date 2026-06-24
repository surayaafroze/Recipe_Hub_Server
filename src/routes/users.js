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
