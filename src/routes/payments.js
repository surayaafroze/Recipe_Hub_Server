const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { collections } = require('../../db');
const { verifyUser } = require('../middlewares/authMiddleware');
const { ObjectId } = require('mongodb');

const router = express.Router();

// ── Create Premium Membership Checkout ────────────────────────────────────────
router.post('/create-checkout-session', verifyUser, async (req, res) => {
  try {
    const user = req.user;

    // Don't allow already-premium users to buy again
    const userQuery = { $or: [{ id: user.id }] };
    if (ObjectId.isValid(user.id)) {
      userQuery.$or.push({ _id: new ObjectId(user.id) });
    }
    const dbUser = await collections.users.findOne(userQuery);
    if (dbUser && (dbUser.isPremium || dbUser.plan === 'premium')) {
      return res.status(400).json({ error: 'You are already a Premium member.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'RecipeHub Premium Membership',
              description: 'Unlock unlimited recipe creation and premium badge',
            },
            unit_amount: 1500, // $15.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=premium`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`,
      client_reference_id: user.id,
      metadata: { userId: user.id, type: 'premium' }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Create Recipe Purchase Checkout ───────────────────────────────────────────
router.post('/purchase-recipe', verifyUser, async (req, res) => {
  try {
    const user = req.user;
    const { recipeId } = req.body;

    if (!recipeId || !ObjectId.isValid(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID' });
    }

    const recipe = await collections.recipes.findOne({ _id: new ObjectId(recipeId) });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Check if already purchased
    const alreadyPurchased = await collections.payments.findOne({ userId: user.id, recipeId });
    if (alreadyPurchased) {
      return res.status(400).json({ error: 'You already own this recipe.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Recipe: ${recipe.recipeName}`,
              description: `By ${recipe.authorName}`,
            },
            unit_amount: 500, // $5.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=recipe&recipeId=${recipeId}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/recipe/${recipeId}`,
      client_reference_id: user.id,
      metadata: { userId: user.id, recipeId, type: 'recipe' }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Recipe purchase error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Verify Payment Session & Save to DB ───────────────────────────────────────
router.post('/verify-session', verifyUser, async (req, res) => {
  try {
    const { sessionId, type, recipeId } = req.body;
    const user = req.user;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Idempotency: skip if already processed
    const existingPayment = await collections.payments.findOne({ transactionId: sessionId });
    if (existingPayment) {
      return res.json({ message: 'Payment already processed', success: true });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Save payment record
    const paymentData = {
      userId: user.id,
      userEmail: user.email,
      amount: session.amount_total / 100,
      transactionId: sessionId,
      paymentStatus: session.payment_status,
      type: type || 'premium',
      paidAt: new Date(),
    };

    if (type === 'recipe' && recipeId) {
      paymentData.recipeId = recipeId;
    }

    await collections.payments.insertOne(paymentData);

    // If premium purchase, upgrade user plan and isPremium status.
    // Safeguard: Do NOT modify the user's role (admin/user) under any circumstance.
    if (type !== 'recipe') {
      const updateQuery = { $or: [{ id: user.id }, { email: user.email }] };
      if (ObjectId.isValid(user.id)) {
        updateQuery.$or.push({ _id: new ObjectId(user.id) });
      }
      await collections.users.updateOne(
        updateQuery,
        { $set: { plan: 'premium', isPremium: true, updatedAt: new Date() } }
      );
    }

    return res.json({ message: 'Payment successful', success: true });
  } catch (error) {
    console.error('Verify session error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
