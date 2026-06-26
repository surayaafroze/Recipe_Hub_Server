<div align="center">
  <h1>⚙️ RecipeHub Server</h1>
  <p><strong>Robust Express.js Backend API for RecipeHub</strong></p>

  [![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Stripe](https://img.shields.io/badge/Stripe-626CD9?style=for-the-badge&logo=Stripe&logoColor=white)](https://stripe.com/)
</div>

<br />

## 📖 Server Overview
The RecipeHub Server is a fast, scalable, and secure RESTful API built with Node.js and Express. It serves as the backbone for the RecipeHub client application, handling database operations, secure user authorization, payment verifications via Stripe, and comprehensive platform data management.

## 🔌 API Overview
The backend provides structured modular routes to separate concerns effectively:
- `/api/users`: Handle user data fetching, role checks, and profile updates.
- `/api/recipes`: Manage CRUD operations for recipes, fetching feeds, and featured items.
- `/api/favorites`: Manage user's favorite recipe collections.
- `/api/reports`: Allow users to report content, and admins to review them.
- `/api/payments`: Process Stripe payment success endpoints to upgrade user status.
- `/api/admin`: Protected endpoints dedicated to gathering platform statistics and managing administrative actions (blocking users, managing all recipes).

---

## 🛡️ Authentication Flow
Authentication is primarily handled securely via **Better Auth** (which manages its own sessions and tokens). The backend validates user identities by checking the session cookies sent from the client or verifying JWT tokens if fallback is required.
1. Client logs in via Better Auth (Google or Email/Password).
2. Better Auth sets an `HttpOnly` secure session cookie.
3. API requests to the backend include `credentials: 'include'`.
4. The server verifies the session status before allowing access to protected resources.

## 🔐 Authorization Flow
Authorization is handled via Role-Based Access Control (RBAC):
- **User (Default)**: Can read/write their own recipes, add favorites, submit reports, and initiate payments.
- **Premium User (`isPremium: true`)**: Same as a regular user, but bypasses recipe creation limits. *Premium status DOES NOT grant admin access.*
- **Admin (`role: "admin"`)**: Complete access to view all users, block/unblock, edit/delete any recipe, view reports, and view platform statistics.

---

## 🗄️ Database Collections
The application uses the native `mongodb` driver and manages the following primary collections:

- **`users`**: Stores user profiles, emails, roles (`user`, `admin`), premium status (`isPremium`), and Better Auth metadata.
- **`recipes`**: Stores all recipes including titles, ingredients, instructions, author references, image URLs, and `isFeatured` status.
- **`favorites`**: Maps `userId` to `recipeId` for tracking users' favorite recipes.
- **`reports`**: Stores reports filed by users, including the report reason, target recipe/user, and resolution status.
- **`payments`**: Records successful Stripe transactions, mapping a `transactionId` to a `userId` and amount.

---

## 🔒 Security Features
- **Protected APIs**: Critical endpoints require active sessions.
- **Role-Based Access (Middleware)**: Admin endpoints rigidly verify `user.role === 'admin'`.
- **CORS Configuration**: Restricted to trusted origins (the frontend client).
- **Environment Secrets**: All sensitive keys (Stripe, Mongo, etc.) are kept entirely in `.env`.

---

## 💻 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Native Driver)
- **Payments**: Stripe Node SDK
- **Security**: cors, jose-cjs

### Major NPM Packages
- `express`
- `mongodb`
- `stripe`
- `cors`
- `dotenv`
- `jose-cjs`

---

## 🔐 Environment Setup

Environment variables are required for:
- Authentication
- MongoDB
- Google OAuth
- Image Upload Service
- Stripe Payments

Please configure the required environment variables locally before running the project.

---

## 🚀 Installation Guide & Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/Recipe_Hub_Server.git
   cd Recipe_Hub_Server/recipe-hub-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the Development Server**
   ```bash
   node index.js
   ```
   The server will start on `http://localhost:5000` (or your defined `PORT`).

---

## 📡 API Endpoints Summary (Brief)

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/api/recipes` | GET | Fetch public/all recipes | Public |
| `/api/recipes` | POST | Create a new recipe | Authenticated |
| `/api/admin/stats` | GET | Fetch platform statistics | Admin Only |
| `/api/users/block/:id` | PATCH | Block/Unblock a user | Admin Only |
| `/api/payments/success` | POST | Verify Stripe payment & upgrade user | Authenticated |
| `/api/reports` | POST | Submit a new report | Authenticated |

---

## ⚠️ Error Handling
The server implements a centralized global error handling middleware to catch unhandled exceptions and prevent server crashes. It returns clean, standard JSON error responses (`{ message: "Something went wrong..." }`) with appropriate HTTP status codes (400, 401, 403, 404, 500).

<br />
<div align="center">
  <p>Built with ❤️ for Recipe Hub</p>
</div>
