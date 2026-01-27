import jwt from "jsonwebtoken";

const AUTH_SECRET = process.env.AUTH_SECRET;
export async function authenticateJWT(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) return res.sendStatus(401);
  jwt.verify(token, AUTH_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
