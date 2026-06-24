const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const verifyToken = async (req, res, next) => {
  try {
    // Forward the browser's raw Cookie header directly to better-auth get-session.
    // This is the ONLY reliable method because better-auth uses signed, HTTP-only
    // cookies that cannot be read by JavaScript or reconstructed manually.
    const cookieHeader = req.headers['cookie'] || '';

    const response = await fetch(`${CLIENT_URL}/api/auth/get-session`, {
      headers: {
        'Cookie': cookieHeader
      }
    });

    if (!response.ok) {
      return res.status(401).json({ msg: "unauthorized" });
    }

    const data = await response.json();
    if (!data || !data.user) {
      return res.status(401).json({ msg: "unauthorized" });
    }

    req.user = data.user;

    // Normalize id/_id
    if (!req.user.id && req.user._id) req.user.id = String(req.user._id);
    if (req.user.id && !req.user._id) req.user._id = req.user.id;

    next();
  } catch (error) {
    console.error('Auth verification error:', error.message);
    return res.status(401).json({ msg: "unauthorized" });
  }
};

module.exports = { verifyToken };
