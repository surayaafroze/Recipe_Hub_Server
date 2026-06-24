const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyUser, requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// ── Admin: List all users ──────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await collections.users.find({}).sort({ createdAt: -1 }).toArray();
    const sanitizedUsers = users.map(({ password, ...safeUser }) => safeUser);
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Admin: Block / Unblock user ────────────────────────────────────────────────
router.patch('/users/:id/block', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ error: 'isBlocked must be a boolean' });
    }

    // Prevent admin from blocking themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot block your own account.' });
    }

    const query = { $or: [{ id: userId }] };
    if (ObjectId.isValid(userId)) {
      query.$or.push({ _id: new ObjectId(userId) });
    }

    const result = await collections.users.updateOne(
      query,
      { $set: { isBlocked, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`, isBlocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Admin: List all payments ───────────────────────────────────────────────────
router.get('/payments', requireAdmin, async (req, res) => {
  try {
    const payments = await collections.payments.find({}).sort({ paidAt: -1 }).toArray();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Admin: Platform stats ──────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const usersCount = await collections.users.countDocuments();
    const premiumCount = await collections.users.countDocuments({
      $or: [{ isPremium: true }, { plan: 'premium' }]
    });
    const recipesCount = await collections.recipes.countDocuments();
    const totalReportsCount = await collections.reports.countDocuments({});
    const pendingReportsCount = await collections.reports.countDocuments({ status: 'pending' });
    const paymentsAggr = await collections.payments.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();

    res.json({
      totalUsers: usersCount,
      totalPremiumMembers: premiumCount,
      totalRecipes: recipesCount,
      totalReports: totalReportsCount,
      pendingReports: pendingReportsCount,
      totalRevenue: paymentsAggr.length > 0 ? paymentsAggr[0].total : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
