const { collections } = require('../../db');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ─── Core Token Verification ──────────────────────────────────────────────────
// Strategy 1: Bearer token in Authorization header via Better Auth get-session (JWT)
// Strategy 2: Bearer token fallback directly to MongoDB (Legacy Opaque Tokens)
// Strategy 3: Forward browser Cookie to better-auth get-session (localhost)
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const cookieHeader = req.headers['cookie'] || '';

    let sessionData = null;
    let tokenStr = null;

    // Strategy 1: Bearer JWT token -> Better Auth
    if (authHeader.startsWith('Bearer ')) {
      tokenStr = authHeader.slice(7);
      if (tokenStr && tokenStr !== 'undefined' && tokenStr !== 'null' && tokenStr.length > 10) {
        const response = await fetch(`${CLIENT_URL}/api/auth/get-session`, {
          headers: {
            'Cookie': `better-auth.session_token=${tokenStr}; __Secure-better-auth.session_token=${tokenStr}`,
            'Authorization': `Bearer ${tokenStr}`,
            'Origin': CLIENT_URL
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.user) sessionData = data;
        }
      }
    }

    // Strategy 2: Direct MongoDB check for Legacy Opaque Tokens
    // If user logged in before JWT was enabled, their token won't work in Strategy 1
    if (!sessionData && tokenStr && collections.sessions) {
      const dbSession = await collections.sessions.findOne({ token: tokenStr });
      if (dbSession && new Date() < new Date(dbSession.expiresAt)) {
        const dbUser = await collections.users.findOne({ _id: dbSession.userId });
        if (dbUser) {
          sessionData = { user: dbUser };
        }
      }
    }

    // Strategy 3: Cookie forwarding (fallback for localhost without Bearer token)
    if (!sessionData && cookieHeader) {
      const response = await fetch(`${CLIENT_URL}/api/auth/get-session`, {
        headers: { 
          'Cookie': cookieHeader,
          'Origin': CLIENT_URL 
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.user) sessionData = data;
      }
    }

    if (!sessionData || !sessionData.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    req.user = sessionData.user;

    // Normalize id/_id
    if (!req.user.id && req.user._id) req.user.id = String(req.user._id);
    if (req.user.id && !req.user._id) req.user._id = req.user.id;

    next();
  } catch (error) {
    console.error('Auth verification error:', error.message);
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
};

// ─── Block Check ──────────────────────────────────────────────────────────────
// Must run AFTER verifyToken. Prevents blocked users from doing anything.
const verifyNotBlocked = (req, res, next) => {
  if (req.user && req.user.isBlocked === true) {
    return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });
  }
  next();
};

// ─── Admin Role Guard ─────────────────────────────────────────────────────────
// Must run AFTER verifyToken.
const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Admin only.' });
};

// ─── Convenience Chains ───────────────────────────────────────────────────────
// verifyUser = authenticated + not blocked (for regular protected routes)
const verifyUser = [verifyToken, verifyNotBlocked];
// requireAdmin = authenticated + not blocked + admin role
const requireAdmin = [verifyToken, verifyNotBlocked, verifyAdmin];

module.exports = { verifyToken, verifyNotBlocked, verifyAdmin, verifyUser, requireAdmin };
