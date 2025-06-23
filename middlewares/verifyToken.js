const jwt = require("jsonwebtoken");
const httpErrors = require("http-errors");

const verifyToken = (req, res, next) => {
  try {
    const token = req.headers["authorization"];

    if (!token) {
      return res.status(403).json({
        message: "No token provided!",
        status: 403,
      });
    }

    const bearer = token.split(" ");
    if (bearer.length !== 2 || bearer[0].toLowerCase() !== "bearer") {
      return res.status(400).json({
        message: "Invalid token format. Use 'Bearer <token>'",
        status: 400,
      });
    }

    const bearerToken = bearer[1];

    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          message: "Unauthorized! " + (err.message || "Invalid token"),
          status: 401,
        });
      }
      // Extract id and role from the decoded token
      req.userId = decoded.id;
      req.userRole = decoded.role || null; // Allow role to be optional
      if (!req.userId) {
        // Only require userId
        return res.status(401).json({
          message: "Invalid token payload: missing id",
          status: 401,
        });
      }
      next();
    });
  } catch (error) {
    next(httpErrors.Unauthorized());
  }
};

module.exports = verifyToken;
