const jwt = require("jsonwebtoken");

function autenticar(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ erro: "token_ausente" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ erro: "token_invalido" });
  }
}

module.exports = { autenticar };
