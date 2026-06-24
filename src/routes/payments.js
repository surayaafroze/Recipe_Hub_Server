const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { collections } = require('../../db');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price: 'price_1TlLmXCi3GOPWqHxjMUTnTke', // User provided Stripe price ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`,
      client_reference_id: user.id
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/purchase-recipe', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const { recipeId } = req.body;
    
    const { ObjectId } = require('mongodb');
    if (!ObjectId.isValid(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID' });
    }
    const recipe = await collections.recipes.findOne({ _id: new ObjectId(recipeId) });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Recipe: ${recipe.recipeName}`,
            },
            unit_amount: 500, // Fixed $5 price for recipes
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=recipe&recipeId=${recipeId}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/recipe/${recipeId}`,
      client_reference_id: user.id
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-session', verifyToken, async (req, res) => {
  try {
    const { sessionId, type, recipeId } = req.body;
    const user = req.user;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Check if payment was already processed to avoid duplicates
    const existingPayment = await collections.payments.findOne({ transactionId: sessionId });
    if (existingPayment) {
      return res.json({ message: 'Payment already processed', isPremium: true });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // 1. Save payment into payments collection
      const paymentData = {
        userId: user.id,
        userEmail: user.email,
        amount: session.amount_total / 100, // convert cents to standard currency
        transactionId: sessionId,
        paymentStatus: session.payment_status,
        paidAt: new Date()
      };
      
      if (type === 'recipe' && recipeId) {
        paymentData.recipeId = recipeId;
      }
      
      await collections.payments.insertOne(paymentData);

      if (type !== 'recipe') {
        // Mark user as premium in Better Auth users collection
        await collections.users.updateOne(
          { id: user.id }, // Note: BetterAuth uses `id`, not MongoDB `_id`
          { $set: { plan: 'premium', isPremium: true } }
        );
      }

      return res.json({ message: 'Payment successful', isPremium: type !== 'recipe' });
    }

    res.status(400).json({ error: 'Payment not successful yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
