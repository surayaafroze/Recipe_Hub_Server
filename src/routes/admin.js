const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Admin only.' });
};

// Users Listing
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await collections.users.find({}).sort({ createdAt: -1 }).toArray();
    // Sanitize output by not sending passwords if they exist
    const sanitizedUsers = users.map(u => {
       const { password, ...safeUser } = u;
       return safeUser;
    });
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle Block Status
router.patch('/users/:id/block', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id; // Better Auth uses string ID
    const { isBlocked } = req.body;

    const result = await collections.users.updateOne(
      { id: userId },
      { $set: { isBlocked } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User block status updated', isBlocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payments Listing
router.get('/payments', verifyToken, isAdmin, async (req, res) => {
  try {
    const payments = await collections.payments.find({}).sort({ paidAt: -1 }).toArray();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Stats Overview
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const usersCount = await collections.users.countDocuments();
    const premiumCount = await collections.users.countDocuments({ 
      $or: [{ isPremium: true }, { plan: 'premium' }] 
    });
    const recipesCount = await collections.recipes.countDocuments();
    const reportsCount = await collections.reports.countDocuments({ status: 'pending' });
    const paymentsAggr = await collections.payments.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).toArray();
    
    res.json({
      totalUsers: usersCount,
      totalPremiumMembers: premiumCount,
      totalRecipes: recipesCount,
      pendingReports: reportsCount,
      totalRevenue: paymentsAggr.length > 0 ? paymentsAggr[0].total : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
