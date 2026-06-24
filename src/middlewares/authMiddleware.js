const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

const jwks = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

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
    const { payload } = await jwtVerify(token, jwks);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ msg: "unauthorized" });
  }
};

module.exports = { verifyToken };
