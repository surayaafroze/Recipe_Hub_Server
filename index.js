const express = require('express');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const { connectDB } = require('./db');
require('dotenv').config()

const app = express()
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000

// Import routes
const recipeRoutes = require('./src/routes/recipes');
const favoriteRoutes = require('./src/routes/favorites');
const reportRoutes = require('./src/routes/reports');
const paymentRoutes = require('./src/routes/payments');

app.get('/', (req, res) => {
  res.send('RecipeHub Server is running!')
})

// Mount routes
app.use('/api/recipes', recipeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', paymentRoutes);





// Auth middleware removed, now imported locally in routes



// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server!' });
});

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
});