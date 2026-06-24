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
    // Validate the token seamlessly with BetterAuth native get-session API
    const response = await fetch('http://localhost:3000/api/auth/get-session', {
      headers: {
        'Cookie': `better-auth.session_token=${token}`
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
    
    // Normalize id
    if (!req.user.id && req.user._id) req.user.id = req.user._id;
    if (req.user.id && !req.user._id) req.user._id = req.user.id;
    
    next();
  } catch (error) {
    console.error('Session Verification Error:', error.message);
    return res.status(401).json({ msg: "unauthorized" });
  }
};

module.exports = { verifyToken };
