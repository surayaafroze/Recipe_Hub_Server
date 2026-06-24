const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ─── Core Token Verification ──────────────────────────────────────────────────
// Forwards the browser's raw Cookie header to better-auth get-session.
// This is the only reliable method since better-auth uses signed HTTP-only cookies.
const verifyToken = async (req, res, next) => {
  try {
    const cookieHeader = req.headers['cookie'] || '';

    const response = await fetch(`${CLIENT_URL}/api/auth/get-session`, {
      headers: { 'Cookie': cookieHeader }
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const data = await response.json();
    if (!data || !data.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    req.user = data.user;

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
