const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Middleware for Admin access
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Admin only.' });
};

// POST: Create a report (Any logged-in user)
router.post('/', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const { recipeId, reason } = req.body;

    if (!recipeId || !reason) {
      return res.status(400).json({ error: 'recipeId and reason are required' });
    }

    const newReport = {
      recipeId,
      reporterEmail: user.email,
      reason,
      status: 'pending',
      createdAt: new Date()
    };

    const result = await collections.reports.insertOne(newReport);
    res.status(201).json({ message: 'Report submitted successfully', reportId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Fetch all reports (Admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const reports = await collections.reports.find({}).sort({ createdAt: -1 }).toArray();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update report status (Admin only)
router.patch('/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const reportId = new ObjectId(req.params.id);
    const { status } = req.body; // e.g., 'dismissed', 'removed'

    if (!['dismissed', 'removed'].includes(status)) {
       return res.status(400).json({ error: 'Invalid status. Must be dismissed or removed' });
    }

    const result = await collections.reports.updateOne(
      { _id: reportId },
      { $set: { status: status } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
