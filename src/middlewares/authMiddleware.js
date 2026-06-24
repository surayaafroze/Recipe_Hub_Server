const { jwtVerify } = require('jose-cjs');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ msg: "unauthorized" });
  }
  
  try {
    // We now use the BETTER_AUTH_SECRET to verify the JWT session cookie 
    // that getValidToken fetches from the Next.js API route.
    const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // better-auth JWT payload contains session and user objects
    req.user = payload.user || payload.session?.user || payload;
    
    // Some routes expect id instead of _id or vice versa
    if (!req.user.id && req.user._id) {
        req.user.id = req.user._id;
    } else if (req.user.id && !req.user._id) {
        req.user._id = req.user.id;
    }
    
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ msg: "unauthorized" });
  }
};

module.exports = { verifyToken };
