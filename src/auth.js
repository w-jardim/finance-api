const jwt = require("jsonwebtoken");

function autenticar(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ erro: "token_ausente" });

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ erro: "jwt_secret_nao_configurado" });

    const payload = jwt.verify(token, secret);

    // subject (sub) deve ser ID numérico (BIGINT). Token antigo (UUID) vira NaN e é rejeitado.
    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ erro: "token_invalido_userid" });
    }

    req.usuario = { id: userId, email: payload.email || null };
    return next();
  } catch {
    return res.status(401).json({ erro: "token_invalido" });
  }
}

module.exports = { autenticar };
