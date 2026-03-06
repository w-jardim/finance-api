const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { autenticar } = require("./auth");

const app = express();
app.use(express.json());

// CORS: use ALLOWED_ORIGINS env var (comma-separated) or defaults
const allowedOrigins = new Set(
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : [
        "https://virazul.com",
        "https://www.virazul.com",
        "https://finance-dev.gardenwjs.tech",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
      ]
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error("CORS: origin not allowed"), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", env: process.env.NODE_ENV || "dev" });
});

app.post("/auth/registrar", async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "email_e_senha_obrigatorios" });

  const senha_hash = await bcrypt.hash(senha, 10);

  try {
    const r = await db.query(
      "INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2) RETURNING id, email, criado_em",
      [String(email).toLowerCase(), senha_hash]
    );
    return res.status(201).json({ usuario: r.rows[0] });
  } catch (e) {
    if (String(e).includes("usuarios_email_key")) return res.status(409).json({ erro: "email_ja_cadastrado" });
    return res.status(500).json({ erro: "erro_interno" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "email_e_senha_obrigatorios" });

  const r = await db.query("SELECT id, email, senha_hash FROM usuarios WHERE email = $1", [
    String(email).toLowerCase(),
  ]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ erro: "credenciais_invalidas" });

  const ok = await bcrypt.compare(senha, user.senha_hash);
  if (!ok) return res.status(401).json({ erro: "credenciais_invalidas" });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ erro: "jwt_secret_nao_configurado" });

  const token = jwt.sign({ email: user.email }, secret, { subject: String(user.id), expiresIn: "7d" });
  return res.status(200).json({ token });
});

app.get("/me", autenticar, async (req, res) => {
  const r = await db.query("SELECT id, email, criado_em FROM usuarios WHERE id = $1", [req.usuario.id]);
  return res.json({ usuario: r.rows[0] });
});

app.get("/contas", autenticar, async (req, res) => {
  const r = await db.query(
    "SELECT id, nome, criado_em FROM contas WHERE usuario_id = $1 ORDER BY criado_em DESC",
    [req.usuario.id]
  );
  return res.json({ contas: r.rows });
});

app.post("/contas", autenticar, async (req, res) => {
  const { nome } = req.body || {};
  if (!nome || !String(nome).trim()) return res.status(400).json({ erro: "nome_obrigatorio" });

  const r = await db.query(
    "INSERT INTO contas (usuario_id, nome) VALUES ($1, $2) RETURNING id, nome, criado_em",
    [req.usuario.id, String(nome).trim()]
  );
  return res.status(201).json({ conta: r.rows[0] });
});

// Obter uma conta por id
app.get("/contas/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query(
      "SELECT id, nome, criado_em FROM contas WHERE id = $1 AND usuario_id = $2",
      [id, req.usuario.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ erro: "conta_nao_encontrada" });
    return res.json({ conta: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

app.get("/categorias", autenticar, async (req, res) => {
  const tipo = req.query.tipo;

  if (tipo && !["entrada", "saida", "reserva"].includes(tipo)) {
    return res.status(400).json({ erro: "tipo_invalido" });
  }

  const params = [req.usuario.id];
  let sql = "SELECT id, nome, tipo, criado_em FROM categorias WHERE usuario_id = $1";

  if (tipo) {
    params.push(tipo);
    sql += " AND tipo = $2";
  }

  sql += " ORDER BY criado_em DESC";

  const r = await db.query(sql, params);
  return res.json({ categorias: r.rows });
});

app.post("/categorias", autenticar, async (req, res) => {
  const { nome, tipo } = req.body || {};
  if (!nome || !String(nome).trim()) return res.status(400).json({ erro: "nome_obrigatorio" });
  if (!tipo || !["entrada", "saida", "reserva"].includes(tipo)) return res.status(400).json({ erro: "tipo_invalido" });

  try {
    const r = await db.query(
      "INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id, nome, tipo, criado_em",
      [req.usuario.id, String(nome).trim(), tipo]
    );
    return res.status(201).json({ categoria: r.rows[0] });
  } catch (e) {
    if (String(e).includes("categorias_usuario_id_nome_tipo_key")) return res.status(409).json({ erro: "categoria_duplicada" });
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Obter uma categoria por id
app.get("/categorias/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query(
      "SELECT id, nome, tipo, criado_em FROM categorias WHERE id = $1 AND usuario_id = $2",
      [id, req.usuario.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ erro: "categoria_nao_encontrada" });
    return res.json({ categoria: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

app.get("/lancamentos", autenticar, async (req, res) => {
  const { inicio, fim, tipo } = req.query;

  const params = [req.usuario.id];
  let sql = `
    SELECT l.id, l.conta_id, l.categoria_id, l.tipo, l.valor_centavos, l.descricao, l.data_ocorrencia, l.criado_em,
           l.origem_lancamento_id, c.nome AS conta_nome, cat.nome AS categoria_nome
    FROM lancamentos l
    LEFT JOIN contas c ON c.id = l.conta_id
    LEFT JOIN categorias cat ON cat.id = l.categoria_id
    WHERE l.usuario_id = $1
  `;

  if (inicio) {
    params.push(inicio);
    sql += ` AND l.data_ocorrencia >= $${params.length}`;
  }
  if (fim) {
    params.push(fim);
    sql += ` AND l.data_ocorrencia <= $${params.length}`;
  }

  if (tipo && ["entrada", "saida", "reserva"].includes(tipo)) {
    params.push(tipo);
    sql += ` AND l.tipo = $${params.length}`;
  }

  sql += " ORDER BY l.data_ocorrencia DESC, l.criado_em DESC";

  const r = await db.query(sql, params);

  const lancamentos = r.rows.map((l) => ({
    id: l.id,
    conta_id: l.conta_id,
    categoria_id: l.categoria_id,
    tipo: l.tipo,
    valor_centavos: Number(l.valor_centavos),
    descricao: l.descricao,
    data_ocorrencia: l.data_ocorrencia,
    criado_em: l.criado_em,
    origem_lancamento_id: l.origem_lancamento_id || null,
    conta: l.conta_nome ? { nome: l.conta_nome } : null,
    categoria: l.categoria_nome ? { nome: l.categoria_nome } : null,
  }));

  return res.json({ lancamentos });
});

// Obter um lancamento por id
app.get("/lancamentos/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query(
       `SELECT id, conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, origem_lancamento_id, criado_em
         FROM lancamentos WHERE id = $1 AND usuario_id = $2`,
      [id, req.usuario.id]
    );

    if (r.rowCount === 0) return res.status(404).json({ erro: "lancamento_nao_encontrado" });

    const lancamento = r.rows[0];
    lancamento.valor_centavos = Number(lancamento.valor_centavos);

    return res.json({ lancamento });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

app.post("/lancamentos", autenticar, async (req, res) => {
  const { conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, origem_lancamento_id } = req.body || {};

  if (!conta_id) return res.status(400).json({ erro: "conta_id_obrigatorio" });
  if (!tipo || !["entrada", "saida", "reserva"].includes(tipo)) return res.status(400).json({ erro: "tipo_invalido" });
  if (!Number.isInteger(valor_centavos) || valor_centavos <= 0) return res.status(400).json({ erro: "valor_centavos_invalido" });
  if (!data_ocorrencia) return res.status(400).json({ erro: "data_ocorrencia_obrigatoria" });

  const conta = await db.query("SELECT id FROM contas WHERE id = $1 AND usuario_id = $2", [
    conta_id,
    req.usuario.id,
  ]);
  if (conta.rowCount === 0) return res.status(403).json({ erro: "conta_nao_permitida" });

  if (categoria_id) {
    const cat = await db.query("SELECT id FROM categorias WHERE id = $1 AND usuario_id = $2", [
      categoria_id,
      req.usuario.id,
    ]);
    if (cat.rowCount === 0) return res.status(403).json({ erro: "categoria_nao_permitida" });
  }

  if (origem_lancamento_id) {
    // must reference an existing entrada belonging to the user
    const rOrig = await db.query("SELECT id, tipo, usuario_id FROM lancamentos WHERE id = $1", [origem_lancamento_id]);
    if (rOrig.rowCount === 0) return res.status(400).json({ erro: "origem_invalida" });
    const o = rOrig.rows[0];
    if (String(o.usuario_id) !== String(req.usuario.id)) return res.status(403).json({ erro: "origem_nao_permitida" });
    if (o.tipo !== 'entrada') return res.status(400).json({ erro: "origem_nao_entrada" });
  }

  const r = await db.query(
    `INSERT INTO lancamentos (usuario_id, conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, origem_lancamento_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, origem_lancamento_id, criado_em`,
    [
      req.usuario.id,
      conta_id,
      categoria_id || null,
      tipo,
      valor_centavos,
      descricao || null,
      data_ocorrencia,
      origem_lancamento_id || null,
    ]
  );

  const lancamento = r.rows[0];
  lancamento.valor_centavos = Number(lancamento.valor_centavos);
  lancamento.origem_lancamento_id = lancamento.origem_lancamento_id || null;
  lancamento.origem_lancamento_id = lancamento.origem_lancamento_id || null;

  return res.status(201).json({ lancamento });
});

// Atualizar conta
app.put("/contas/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body || {};

  if (!nome || !String(nome).trim()) return res.status(400).json({ erro: "nome_obrigatorio" });

  try {
    const r = await db.query(
      "UPDATE contas SET nome = $1 WHERE id = $2 AND usuario_id = $3 RETURNING id, nome, criado_em",
      [String(nome).trim(), id, req.usuario.id]
    );

    if (r.rowCount === 0) return res.status(403).json({ erro: "conta_nao_permitida" });

    return res.json({ conta: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Deletar conta
app.delete("/contas/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query("DELETE FROM contas WHERE id = $1 AND usuario_id = $2 RETURNING id", [id, req.usuario.id]);
    if (r.rowCount === 0) return res.status(403).json({ erro: "conta_nao_permitida" });
    return res.status(204).send();
  } catch (e) {
    // possível restrição de FK
    if (String(e).toLowerCase().includes("restrict") || String(e).toLowerCase().includes("violates")) {
      return res.status(409).json({ erro: "conta_nao_pode_ser_deletada" });
    }
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Atualizar categoria
app.put("/categorias/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const { nome, tipo } = req.body || {};

  if (!nome || !String(nome).trim()) return res.status(400).json({ erro: "nome_obrigatorio" });
  if (!tipo || !["entrada", "saida", "reserva"].includes(tipo)) return res.status(400).json({ erro: "tipo_invalido" });

  try {
    const r = await db.query(
      "UPDATE categorias SET nome = $1, tipo = $2 WHERE id = $3 AND usuario_id = $4 RETURNING id, nome, tipo, criado_em",
      [String(nome).trim(), tipo, id, req.usuario.id]
    );

    if (r.rowCount === 0) return res.status(403).json({ erro: "categoria_nao_permitida" });

    return res.json({ categoria: r.rows[0] });
  } catch (e) {
    if (String(e).includes("categorias_usuario_id_nome_tipo_key")) return res.status(409).json({ erro: "categoria_duplicada" });
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Deletar categoria
app.delete("/categorias/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query("DELETE FROM categorias WHERE id = $1 AND usuario_id = $2 RETURNING id", [id, req.usuario.id]);
    if (r.rowCount === 0) return res.status(403).json({ erro: "categoria_nao_permitida" });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Atualizar lancamento
app.put("/lancamentos/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const { conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, origem_lancamento_id } = req.body || {};

  if (!conta_id) return res.status(400).json({ erro: "conta_id_obrigatorio" });
  if (!tipo || !["entrada", "saida", "reserva"].includes(tipo)) return res.status(400).json({ erro: "tipo_invalido" });
  if (!Number.isInteger(valor_centavos) || valor_centavos <= 0) return res.status(400).json({ erro: "valor_centavos_invalido" });
  if (!data_ocorrencia) return res.status(400).json({ erro: "data_ocorrencia_obrigatoria" });

  const conta = await db.query("SELECT id FROM contas WHERE id = $1 AND usuario_id = $2", [conta_id, req.usuario.id]);
  if (conta.rowCount === 0) return res.status(403).json({ erro: "conta_nao_permitida" });

  if (categoria_id) {
    const cat = await db.query("SELECT id FROM categorias WHERE id = $1 AND usuario_id = $2", [categoria_id, req.usuario.id]);
    if (cat.rowCount === 0) return res.status(403).json({ erro: "categoria_nao_permitida" });
  }

  if (origem_lancamento_id) {
    const rOrig = await db.query("SELECT id, tipo, usuario_id FROM lancamentos WHERE id = $1", [origem_lancamento_id]);
    if (rOrig.rowCount === 0) return res.status(400).json({ erro: "origem_invalida" });
    const o = rOrig.rows[0];
    if (String(o.usuario_id) !== String(req.usuario.id)) return res.status(403).json({ erro: "origem_nao_permitida" });
    if (o.tipo !== 'entrada') return res.status(400).json({ erro: "origem_nao_entrada" });
  }

  try {
    const r = await db.query(
      `UPDATE lancamentos SET conta_id=$1, categoria_id=$2, tipo=$3, valor_centavos=$4, descricao=$5, data_ocorrencia=$6, origem_lancamento_id=$9
       WHERE id = $7 AND usuario_id = $8
       RETURNING id, conta_id, categoria_id, tipo, valor_centavos, descricao, data_ocorrencia, origem_lancamento_id, criado_em`,
      [conta_id, categoria_id || null, tipo, valor_centavos, descricao || null, data_ocorrencia, id, req.usuario.id, origem_lancamento_id || null]
    );

    if (r.rowCount === 0) return res.status(403).json({ erro: "lancamento_nao_permitido" });

    const lancamento = r.rows[0];
    lancamento.valor_centavos = Number(lancamento.valor_centavos);
    lancamento.origem_lancamento_id = lancamento.origem_lancamento_id || null;

    return res.json({ lancamento });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Deletar lancamento
app.delete("/lancamentos/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query("DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2 RETURNING id", [id, req.usuario.id]);
    if (r.rowCount === 0) return res.status(403).json({ erro: "lancamento_nao_permitido" });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// ============= RESERVAS =============

// Listar reservas
app.get("/reservas", autenticar, async (req, res) => {
  const { status, inicio, fim } = req.query;

  const params = [req.usuario.id];
  let sql = `
    SELECT r.id, r.conta_id, r.categoria_id, r.valor_centavos, r.descricao, r.data_alvo, r.status, r.criado_em, r.atualizado_em,
           c.nome AS conta_nome, cat.nome AS categoria_nome
    FROM reservas r
    LEFT JOIN contas c ON c.id = r.conta_id
    LEFT JOIN categorias cat ON cat.id = r.categoria_id
    WHERE r.usuario_id = $1
  `;

  if (status && ["ativa", "utilizada", "cancelada"].includes(status)) {
    params.push(status);
    sql += ` AND r.status = $${params.length}`;
  }

  if (inicio) {
    params.push(inicio);
    sql += ` AND r.data_alvo >= $${params.length}`;
  }
  if (fim) {
    params.push(fim);
    sql += ` AND r.data_alvo <= $${params.length}`;
  }

  sql += " ORDER BY r.data_alvo DESC, r.criado_em DESC";

  try {
    const r = await db.query(sql, params);

    const reservas = r.rows.map((res) => ({
      id: res.id,
      conta_id: res.conta_id,
      categoria_id: res.categoria_id,
      valor_centavos: Number(res.valor_centavos),
      descricao: res.descricao,
      data_alvo: res.data_alvo,
      status: res.status,
      criado_em: res.criado_em,
      atualizado_em: res.atualizado_em,
      conta: res.conta_nome ? { nome: res.conta_nome } : null,
      categoria: res.categoria_nome ? { nome: res.categoria_nome } : null,
    }));

    return res.json({ reservas });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Obter uma reserva por id
app.get("/reservas/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query(
      `SELECT id, conta_id, categoria_id, valor_centavos, descricao, data_alvo, status, criado_em, atualizado_em
       FROM reservas WHERE id = $1 AND usuario_id = $2`,
      [id, req.usuario.id]
    );

    if (r.rowCount === 0) return res.status(404).json({ erro: "reserva_nao_encontrada" });

    const reserva = r.rows[0];
    reserva.valor_centavos = Number(reserva.valor_centavos);

    return res.json({ reserva });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Criar reserva
app.post("/reservas", autenticar, async (req, res) => {
  const { conta_id, categoria_id, valor_centavos, descricao, data_alvo, status } = req.body || {};

  if (!conta_id) return res.status(400).json({ erro: "conta_id_obrigatorio" });
  if (!Number.isInteger(valor_centavos) || valor_centavos <= 0) return res.status(400).json({ erro: "valor_centavos_invalido" });
  if (!data_alvo) return res.status(400).json({ erro: "data_alvo_obrigatoria" });

  const statusValor = status || "ativa";
  if (!["ativa", "utilizada", "cancelada"].includes(statusValor)) {
    return res.status(400).json({ erro: "status_invalido" });
  }

  // Verificar se a conta pertence ao usuário
  const conta = await db.query("SELECT id FROM contas WHERE id = $1 AND usuario_id = $2", [conta_id, req.usuario.id]);
  if (conta.rowCount === 0) return res.status(403).json({ erro: "conta_nao_permitida" });

  // Verificar categoria se fornecida
  if (categoria_id) {
    const cat = await db.query("SELECT id FROM categorias WHERE id = $1 AND usuario_id = $2", [categoria_id, req.usuario.id]);
    if (cat.rowCount === 0) return res.status(403).json({ erro: "categoria_nao_permitida" });
  }

  try {
    const r = await db.query(
      `INSERT INTO reservas (usuario_id, conta_id, categoria_id, valor_centavos, descricao, data_alvo, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, conta_id, categoria_id, valor_centavos, descricao, data_alvo, status, criado_em, atualizado_em`,
      [req.usuario.id, conta_id, categoria_id || null, valor_centavos, descricao || null, data_alvo, statusValor]
    );

    const reserva = r.rows[0];
    reserva.valor_centavos = Number(reserva.valor_centavos);

    return res.status(201).json({ reserva });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Atualizar reserva
app.put("/reservas/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  const { conta_id, categoria_id, valor_centavos, descricao, data_alvo, status } = req.body || {};

  if (!conta_id) return res.status(400).json({ erro: "conta_id_obrigatorio" });
  if (!Number.isInteger(valor_centavos) || valor_centavos <= 0) return res.status(400).json({ erro: "valor_centavos_invalido" });
  if (!data_alvo) return res.status(400).json({ erro: "data_alvo_obrigatoria" });
  if (!status || !["ativa", "utilizada", "cancelada"].includes(status)) {
    return res.status(400).json({ erro: "status_invalido" });
  }

  // Verificar se a conta pertence ao usuário
  const conta = await db.query("SELECT id FROM contas WHERE id = $1 AND usuario_id = $2", [conta_id, req.usuario.id]);
  if (conta.rowCount === 0) return res.status(403).json({ erro: "conta_nao_permitida" });

  // Verificar categoria se fornecida
  if (categoria_id) {
    const cat = await db.query("SELECT id FROM categorias WHERE id = $1 AND usuario_id = $2", [categoria_id, req.usuario.id]);
    if (cat.rowCount === 0) return res.status(403).json({ erro: "categoria_nao_permitida" });
  }

  try {
    const r = await db.query(
      `UPDATE reservas SET conta_id=$1, categoria_id=$2, valor_centavos=$3, descricao=$4, data_alvo=$5, status=$6, atualizado_em=NOW()
       WHERE id = $7 AND usuario_id = $8
       RETURNING id, conta_id, categoria_id, valor_centavos, descricao, data_alvo, status, criado_em, atualizado_em`,
      [conta_id, categoria_id || null, valor_centavos, descricao || null, data_alvo, status, id, req.usuario.id]
    );

    if (r.rowCount === 0) return res.status(403).json({ erro: "reserva_nao_permitida" });

    const reserva = r.rows[0];
    reserva.valor_centavos = Number(reserva.valor_centavos);

    return res.json({ reserva });
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// Deletar reserva
app.delete("/reservas/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query("DELETE FROM reservas WHERE id = $1 AND usuario_id = $2 RETURNING id", [id, req.usuario.id]);
    if (r.rowCount === 0) return res.status(403).json({ erro: "reserva_nao_permitida" });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ erro: "erro_interno" });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, "0.0.0.0", () => {
  console.log(`API rodando em http://0.0.0.0:${port}`);
});
