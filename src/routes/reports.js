const express = require('express');
const { ObjectId } = require('mongodb');
const { collections } = require('../../db');
const { verifyUser, requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// POST: Create a report — AUTH REQUIRED
router.post('/', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const { recipeId, reason } = req.body;

    if (!recipeId || !reason) {
      return res.status(400).json({ error: 'recipeId and reason are required' });
    }

    if (!ObjectId.isValid(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID' });
    }

    // Check if recipe exists
    const recipe = await collections.recipes.findOne({ _id: new ObjectId(recipeId) });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Prevent duplicate reports from same user
    const existingReport = await collections.reports.findOne({
      recipeId,
      reporterEmail: user.email,
      status: 'pending'
    });
    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this recipe' });
    }

    const newReport = {
      recipeId,
      recipeName: recipe.recipeName || '',
      reporterEmail: user.email,
      reporterId: user.id,
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

// GET: All reports — ADMIN ONLY
router.get('/', requireAdmin, async (req, res) => {
  try {
    const reports = await collections.reports.find({}).sort({ createdAt: -1 }).toArray();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update report status — ADMIN ONLY
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const reportId = new ObjectId(req.params.id);
    const { status } = req.body;

    if (!['dismissed', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be dismissed or removed' });
    }

    const report = await collections.reports.findOne({ _id: reportId });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    await collections.reports.updateOne({ _id: reportId }, { $set: { status, resolvedAt: new Date() } });

    // If removing, delete the reported recipe
    if (status === 'removed' && report.recipeId) {
      if (ObjectId.isValid(report.recipeId)) {
        await collections.recipes.deleteOne({ _id: new ObjectId(report.recipeId) });
      }
    }

    res.json({ message: 'Report status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
