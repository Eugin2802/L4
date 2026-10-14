import { Router, type NextFunction, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import {
  AdminLoginBody,
  BlockUserBody,
  CreateCategoryBody,
  CreateFeaturedRequestBody,
  CreateOrderBody,
  CreateProductBody,
  CreateReportBody,
  CreateReviewBody,
  ResolveReportBody,
  SaveProfileBody,
  SetProductFeaturedBody,
  ToggleFavoriteBody,
  UpdateAdminSettingsBody,
  UpdateCategoryBody,
  UpdateOrderStatusBody,
  UpdateProductBody,
} from "@workspace/api-zod";

const router = Router();
type Row = { [column: string]: any };
type SignedInRequest = Request & { userId?: string };

function error(res: Response, status: number, message: string) {
  return res.status(status).json({ message });
}

function signedIn(req: Request, res: Response, next: NextFunction): void {
  const userId = getAuth(req).userId;
  if (!userId) {
    error(res, 401, "Inicia sesión para continuar.");
    return;
  }
  (req as SignedInRequest).userId = userId;
  next();
}

function currentUser(req: Request) {
  return (req as SignedInRequest).userId ?? getAuth(req).userId!;
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function adminSignature(timestamp: string) {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", key).update(`l4-admin:${timestamp}`).digest("hex");
}

function hasAdminSession(req: Request) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("l4_admin="))?.slice("l4_admin=".length);
  if (!cookie) return false;
  const [timestamp, signature] = cookie.split(".");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Date.now() - Number(timestamp) > 8 * 60 * 60 * 1000) return false;
  try {
    return safeEqual(signature, adminSignature(timestamp));
  } catch {
    return false;
  }
}

function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!hasAdminSession(req)) {
    error(res, 401, "Ingresa la clave de administración.");
    return;
  }
  next();
}

async function profileFor(userId: string) {
  const result = await pool.query<Row>("SELECT * FROM l4_profiles WHERE id = $1", [userId]);
  return result.rows[0];
}

async function activeProfile(req: Request, res: Response) {
  const profile = await profileFor(currentUser(req));
  if (!profile) {
    error(res, 403, "Completa tu registro y acepta las condiciones para continuar.");
    return null;
  }
  if (profile.is_blocked) {
    error(res, 403, "Tu cuenta está bloqueada. Comunícate con la administración.");
    return null;
  }
  return profile;
}

function dateString(value: unknown) {
  return value ? new Date(value as string | number | Date).toISOString() : null;
}

function mapProfile(row: Row) {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    shopName: String(row.shop_name),
    phone: String(row.phone),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    isBlocked: Boolean(row.is_blocked),
    isAdmin: Boolean(row.is_admin),
    createdAt: dateString(row.created_at),
  };
}

async function appendResident(row: {
  id: string;
  email: string;
  displayName: string;
  shopName: string;
  phone: string;
  acceptedTerms: boolean;
  isAdult: boolean;
  createdAt: string;
}) {
  const spreadsheetId = process.env.L4_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Google Sheets no está configurado.");
  const connectors = new ReplitConnectors();
  const headerRange = encodeURIComponent("Registros!A1:H1");
  const headerResponse = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [["ID", "Correo", "Nombre", "Tienda", "Teléfono", "Aceptó términos", "Confirmó 18+", "Fecha de registro"]],
      }),
    },
  );
  if (headerResponse.status >= 300) {
    throw new Error(`Google Sheets no pudo preparar los encabezados (${headerResponse.status}).`);
  }
  const range = encodeURIComponent("Registros!A:H");
  const response = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [[row.id, row.email, row.displayName, row.shopName, row.phone, row.acceptedTerms, row.isAdult, row.createdAt]],
      }),
    },
  );
  if (response.status >= 300) {
    throw new Error(`Google Sheets respondió ${response.status}.`);
  }
}

async function productRows(where = "", params: unknown[] = [], sort = "newest") {
  const orderBy = sort === "rating"
    ? "average_rating DESC, p.created_at DESC"
    : sort === "featured"
      ? "active_featured DESC, p.created_at DESC"
      : "p.created_at DESC";
  const result = await pool.query<Row>(
    `SELECT p.*, c.name AS category_name, u.display_name AS seller_name, u.phone AS seller_phone, u.shop_name,
      COALESCE(AVG(r.rating), 0)::float AS average_rating,
      COUNT(r.id)::int AS review_count,
      (p.featured AND p.featured_until > now()) AS active_featured
     FROM l4_products p
     JOIN l4_categories c ON c.id = p.category_id
     JOIN l4_profiles u ON u.id = p.seller_id
     LEFT JOIN l4_reviews r ON r.product_id = p.id
     WHERE u.is_blocked = false ${where}
      GROUP BY p.id, c.name, u.display_name, u.phone, u.shop_name
     ORDER BY ${orderBy}`,
    params,
  );
  return result.rows;
}

function mapProduct(row: Row) {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name),
    sellerPhone: row.seller_phone ? String(row.seller_phone) : null,
    shopName: String(row.shop_name),
    title: String(row.title),
    description: String(row.description),
    price: Number(row.price),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    imageUrl: row.image_url ? String(row.image_url) : null,
    featured: Boolean(row.active_featured),
    featuredUntil: dateString(row.featured_until),
    averageRating: Number(row.average_rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    createdAt: dateString(row.created_at),
  };
}

function mapOrder(row: Row) {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name ?? ""),
    buyerId: String(row.buyer_id),
    buyerName: String(row.buyer_name),
    phone: String(row.phone),
    tower: String(row.tower),
    apartment: String(row.apartment),
    desiredAt: row.desired_at ? String(row.desired_at) : null,
    paymentProofUrl: row.payment_proof_url ? String(row.payment_proof_url) : null,
    total: Number(row.total),
    status: String(row.status),
    confirmed: Boolean(row.confirmed),
    items: row.items as Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>,
    createdAt: dateString(row.created_at),
  };
}

function mapReport(row: Row) {
  return {
    id: String(row.id),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    reporterName: String(row.reporter_name),
    reason: String(row.reason),
    status: String(row.status),
    createdAt: dateString(row.created_at),
  };
}

function mapReview(row: Row) {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    authorName: String(row.author_name),
    rating: Number(row.rating),
    comment: String(row.comment),
  };
}

router.post("/l4/admin/login", async (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Escribe la clave de administración.");
  const password = process.env.L4_ADMIN_PASSWORD;
  if (!password) return error(res, 503, "La clave de administración no está configurada.");
  if (!safeEqual(parsed.data.password, password)) {
    return error(res, 401, "La clave no es correcta.");
  }
  const timestamp = String(Date.now());
  const token = `${timestamp}.${adminSignature(timestamp)}`;
  res.setHeader(
    "Set-Cookie",
    `l4_admin=${token}; Path=/api/l4/admin; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`,
  );
  return res.json({ success: true, message: "Sesión de administración iniciada." });
});

router.get("/l4/profile", signedIn, async (req, res) => {
  const profile = await profileFor(currentUser(req));
  if (!profile) return error(res, 404, "Completa el registro para usar L4.");
  return res.json(mapProfile(profile));
});

router.post("/l4/profile", signedIn, async (req, res) => {
  const parsed = SaveProfileBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Revisa los datos del perfil.");
  if (parsed.data.acceptedTerms !== true || parsed.data.isAdult !== true) {
    return error(res, 403, "Debes aceptar las condiciones y confirmar que tienes 18 años o más.");
  }
  const userId = currentUser(req);
  const existing = await profileFor(userId);
  if (!existing) {
    const createdAt = new Date().toISOString();
    try {
      await appendResident({
        id: userId,
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        shopName: parsed.data.shopName,
        phone: parsed.data.phone,
        acceptedTerms: parsed.data.acceptedTerms,
        isAdult: parsed.data.isAdult,
        createdAt,
      });
    } catch (cause) {
      // Si Google Sheets falla o no está configurado, solo lo registramos en consola pero no bloqueamos al usuario
      console.warn("L4 Google Sheets registration sync skipped/failed:", cause);
    }
  }
  await pool.query(
    `INSERT INTO l4_profiles
      (id, email, display_name, shop_name, phone, avatar_url, accepted_terms, is_adult)
     VALUES ($1, $2, $3, $4, $5, $6, true, true)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       shop_name = EXCLUDED.shop_name,
       phone = EXCLUDED.phone,
       avatar_url = EXCLUDED.avatar_url`,
    [
      userId,
      parsed.data.email,
      parsed.data.displayName,
      parsed.data.shopName,
      parsed.data.phone,
      parsed.data.avatarUrl ?? null,
    ],
  );
  const saved = await profileFor(userId);
  return res.json(mapProfile(saved));
});

router.get("/l4/products", async (req, res) => {
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const sort = ["featured", "rating", "newest"].includes(String(req.query.sort))
    ? String(req.query.sort)
    : "featured";
  const where = categoryId ? "AND p.category_id = $1" : "";
  const rows = await productRows(where, categoryId ? [categoryId] : [], sort);
  return res.json(rows.map(mapProduct));
});

router.post("/l4/products", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Revisa los datos del producto.");
  const exists = await pool.query("SELECT id FROM l4_categories WHERE id = $1", [parsed.data.categoryId]);
  if (!exists.rowCount) return error(res, 400, "Elige una categoría disponible.");
  const id = randomUUID();
  await pool.query(
    `INSERT INTO l4_products (id, seller_id, category_id, title, description, price, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, profile.id, parsed.data.categoryId, parsed.data.title, parsed.data.description, parsed.data.price, parsed.data.imageUrl ?? null],
  );
  const created = await productRows("AND p.id = $1", [id], "newest");
  return res.status(201).json(mapProduct(created[0]));
});

router.patch("/l4/products/:productId", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Revisa los datos del producto.");
  const result = await pool.query(
    `UPDATE l4_products SET category_id = $1, title = $2, description = $3, price = $4, image_url = $5
     WHERE id = $6 AND seller_id = $7`,
    [parsed.data.categoryId, parsed.data.title, parsed.data.description, parsed.data.price, parsed.data.imageUrl ?? null, req.params.productId, profile.id],
  );
  if (!result.rowCount) return error(res, 404, "No encontramos ese producto en tu tienda.");
  const updated = await productRows("AND p.id = $1", [req.params.productId], "newest");
  return res.json(mapProduct(updated[0]));
});

router.delete("/l4/products/:productId", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const result = await pool.query("DELETE FROM l4_products WHERE id = $1 AND seller_id = $2", [req.params.productId, profile.id]);
  if (!result.rowCount) return error(res, 404, "No encontramos ese producto en tu tienda.");
  return res.json({ success: true, message: "Producto eliminado." });
});

router.get("/l4/categories", async (_req, res) => {
  const count = await pool.query<Row>("SELECT COUNT(*)::int AS total FROM l4_categories");
  if (Number(count.rows[0].total) === 0) {
    await pool.query(
      `INSERT INTO l4_categories (id, name) VALUES
        ('cat-alimentos', 'Alimentos'),
        ('cat-bebidas', 'Bebidas'),
        ('cat-hogar', 'Hogar'),
        ('cat-ropa', 'Ropa y accesorios'),
        ('cat-servicios', 'Servicios'),
        ('cat-otros', 'Otros')
       ON CONFLICT (name) DO NOTHING`,
    );
  }
  const result = await pool.query<Row>("SELECT id, name FROM l4_categories ORDER BY name");
  return res.json(result.rows);
});

router.post("/l4/categories", adminOnly, async (req, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Escribe un nombre de categoría válido.");
  const result = await pool.query<Row>(
    "INSERT INTO l4_categories (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id, name",
    [randomUUID(), parsed.data.name.trim()],
  );
  if (!result.rows[0]) return error(res, 409, "Esa categoría ya existe.");
  return res.status(201).json(result.rows[0]);
});

router.patch("/l4/categories/:categoryId", adminOnly, async (req, res) => {
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Escribe un nombre de categoría válido.");
  const result = await pool.query<Row>(
    "UPDATE l4_categories SET name = $1 WHERE id = $2 RETURNING id, name",
    [parsed.data.name.trim(), req.params.categoryId],
  );
  if (!result.rows[0]) return error(res, 404, "No encontramos esa categoría.");
  return res.json(result.rows[0]);
});

router.delete("/l4/categories/:categoryId", adminOnly, async (req, res) => {
  const result = await pool.query("DELETE FROM l4_categories WHERE id = $1", [req.params.categoryId]);
  if (!result.rowCount) return error(res, 404, "No encontramos esa categoría.");
  return res.json({ success: true, message: "Categoría eliminada." });
});

router.get("/l4/products/:productId/reviews", async (req, res) => {
  const result = await pool.query<Row>(
    `SELECT id, product_id, author_name, rating, comment FROM l4_reviews
     WHERE product_id = $1 ORDER BY created_at DESC`,
    [req.params.productId],
  );
  return res.json(result.rows.map(mapReview));
});

router.post("/l4/reviews", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Elige una calificación válida.");
  const orderResult = await pool.query<Row>(
    "SELECT * FROM l4_orders WHERE id = $1 AND buyer_id = $2 AND confirmed = true",
    [parsed.data.orderId, profile.id],
  );
  const order = orderResult.rows[0];
  if (!order || !(order.items as Array<{ productId: string }>).some((item) => item.productId === parsed.data.productId)) {
    return error(res, 403, "Solo puedes calificar un producto de un pedido recibido.");
  }
  const exists = await pool.query("SELECT id FROM l4_reviews WHERE order_id = $1 AND product_id = $2", [parsed.data.orderId, parsed.data.productId]);
  if (exists.rowCount) return error(res, 409, "Ya calificaste este producto.");
  const id = randomUUID();
  await pool.query(
    `INSERT INTO l4_reviews (id, order_id, product_id, author_id, author_name, rating, comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, parsed.data.orderId, parsed.data.productId, profile.id, profile.display_name, parsed.data.rating, parsed.data.comment ?? ""],
  );
  const saved = await pool.query<Row>("SELECT id, product_id, author_name, rating, comment FROM l4_reviews WHERE id = $1", [id]);
  return res.status(201).json(mapReview(saved.rows[0]));
});

router.post("/l4/reports", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Describe el motivo del reporte.");
  const id = randomUUID();
  await pool.query(
    `INSERT INTO l4_reports (id, target_type, target_id, reporter_id, reporter_name, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, parsed.data.targetType, parsed.data.targetId, profile.id, profile.display_name, parsed.data.reason],
  );
  const saved = await pool.query<Row>("SELECT * FROM l4_reports WHERE id = $1", [id]);
  return res.status(201).json(mapReport(saved.rows[0]));
});

router.get("/l4/favorites", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const result = await pool.query<Row>(
    `SELECT p.id FROM l4_products p JOIN l4_favorites f ON f.product_id = p.id
     WHERE f.user_id = $1`,
    [profile.id],
  );
  const products = await Promise.all(result.rows.map(async (row) => {
    const found = await productRows("AND p.id = $1", [row.id], "newest");
    return found[0] ? mapProduct(found[0]) : null;
  }));
  return res.json(products.filter(Boolean));
});

router.post("/l4/favorites", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = ToggleFavoriteBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "No encontramos ese producto.");
  const existing = await pool.query("SELECT product_id FROM l4_favorites WHERE user_id = $1 AND product_id = $2", [profile.id, parsed.data.productId]);
  if (existing.rowCount) {
    await pool.query("DELETE FROM l4_favorites WHERE user_id = $1 AND product_id = $2", [profile.id, parsed.data.productId]);
    return res.json({ success: true, message: "Producto quitado de favoritos." });
  }
  await pool.query("INSERT INTO l4_favorites (user_id, product_id) VALUES ($1, $2)", [profile.id, parsed.data.productId]);
  return res.json({ success: true, message: "Producto guardado en favoritos." });
});

router.get("/l4/orders", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const result = await pool.query<Row>(
    `SELECT o.*, seller.display_name AS seller_name
     FROM l4_orders o
     JOIN l4_profiles seller ON seller.id = o.seller_id
     WHERE o.buyer_id = $1 OR o.seller_id = $1
     ORDER BY o.created_at DESC`,
    [profile.id],
  );
  return res.json(result.rows.map(mapOrder));
});

router.post("/l4/orders", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Completa los datos de entrega.");
  const requested = parsed.data.items;
  const ids = [...new Set(requested.map((item) => item.productId))];
  const found = await pool.query<Row>(
    `SELECT p.*, u.display_name AS seller_name
     FROM l4_products p JOIN l4_profiles u ON u.id = p.seller_id
     WHERE p.id = ANY($1::text[]) AND u.is_blocked = false`,
    [ids],
  );
  if (found.rows.length !== ids.length || found.rows.some((product) => product.seller_id !== parsed.data.sellerId)) {
    return error(res, 400, "El carrito cambió. Vuelve a revisar los productos.");
  }
  const byId = new Map(found.rows.map((product) => [String(product.id), product]));
  const orderItems = requested.map((item) => {
    const product = byId.get(item.productId)!;
    return {
      productId: item.productId,
      productName: String(product.title),
      quantity: item.quantity,
      unitPrice: Number(product.price),
    };
  });
  const total = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const id = randomUUID();
  await pool.query(
    `INSERT INTO l4_orders
      (id, seller_id, buyer_id, buyer_name, phone, tower, apartment, desired_at, payment_proof_url, total, items)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
    [
      id,
      parsed.data.sellerId,
      profile.id,
      profile.display_name,
      parsed.data.phone,
      parsed.data.tower,
      parsed.data.apartment,
      parsed.data.desiredAt ?? null,
      parsed.data.paymentProofUrl ?? null,
      total,
      JSON.stringify(orderItems),
    ],
  );
  const result = await pool.query<Row>(
    `SELECT o.*, seller.display_name AS seller_name
     FROM l4_orders o JOIN l4_profiles seller ON seller.id = o.seller_id WHERE o.id = $1`,
    [id],
  );
  return res.status(201).json(mapOrder(result.rows[0]));
});

router.patch("/l4/orders/:orderId/status", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Elige un estado válido.");
  const result = await pool.query<Row>(
    `UPDATE l4_orders SET status = $1
     WHERE id = $2 AND seller_id = $3
     RETURNING *`,
    [parsed.data.status, req.params.orderId, profile.id],
  );
  if (!result.rows[0]) return error(res, 404, "No encontramos ese pedido de tu tienda.");
  const saved = await pool.query<Row>(
    `SELECT o.*, seller.display_name AS seller_name FROM l4_orders o
     JOIN l4_profiles seller ON seller.id = o.seller_id WHERE o.id = $1`,
    [req.params.orderId],
  );
  return res.json(mapOrder(saved.rows[0]));
});

router.post("/l4/orders/:orderId/confirm", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const result = await pool.query<Row>(
    `UPDATE l4_orders SET confirmed = true
     WHERE id = $1 AND buyer_id = $2 AND status = 'delivered'
     RETURNING *`,
    [req.params.orderId, profile.id],
  );
  if (!result.rows[0]) return error(res, 400, "El vendedor debe marcar el pedido como entregado antes.");
  const saved = await pool.query<Row>(
    `SELECT o.*, seller.display_name AS seller_name FROM l4_orders o
     JOIN l4_profiles seller ON seller.id = o.seller_id WHERE o.id = $1`,
    [req.params.orderId],
  );
  return res.json(mapOrder(saved.rows[0]));
});

router.get("/l4/featured-requests", async (req, res) => {
  const isAdmin = hasAdminSession(req);
  let profile: Row | null = null;
  if (!isAdmin) {
    const userId = getAuth(req).userId;
    if (!userId) return error(res, 401, "Inicia sesión para ver tus solicitudes.");
    profile = await profileFor(userId);
    if (!profile || profile.is_blocked) return error(res, 403, "No puedes ver estas solicitudes.");
  }
  const result = await pool.query<Row>(
    `SELECT f.*, p.title AS product_name, p.price, p.featured_until, seller.display_name AS seller_name
     FROM l4_featured_requests f
     JOIN l4_products p ON p.id = f.product_id
     JOIN l4_profiles seller ON seller.id = f.seller_id
     ${isAdmin ? "" : "WHERE f.seller_id = $1"}
     ORDER BY f.created_at DESC`,
    isAdmin ? [] : [profile!.id],
  );
  return res.json(result.rows.map((row) => ({
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    sellerName: String(row.seller_name),
    price: Number(row.price),
    receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    featuredUntil: dateString(row.featured_until),
    status: String(row.status),
    createdAt: dateString(row.created_at),
  })));
});

router.post("/l4/featured-requests", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const parsed = CreateFeaturedRequestBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Elige un producto para destacar.");
  const product = await pool.query<Row>(
    "SELECT id, seller_id FROM l4_products WHERE id = $1",
    [parsed.data.productId],
  );
  if (!product.rows[0] || product.rows[0].seller_id !== profile.id) {
    return error(res, 404, "Solo puedes solicitar destacar tus propios productos.");
  }
  if (await featuredCountToday() >= 5) {
    return error(res, 409, "Ya se alcanzó el máximo de cinco productos destacados por hoy.");
  }
  const id = randomUUID();
  await pool.query(
    `INSERT INTO l4_featured_requests (id, product_id, seller_id, receipt_url)
     VALUES ($1, $2, $3, $4)`,
    [id, parsed.data.productId, profile.id, parsed.data.receiptUrl ?? null],
  );
  const result = await pool.query<Row>(
    `SELECT f.*, p.title AS product_name, p.price, p.featured_until, seller.display_name AS seller_name
     FROM l4_featured_requests f JOIN l4_products p ON p.id = f.product_id
     JOIN l4_profiles seller ON seller.id = f.seller_id WHERE f.id = $1`,
    [id],
  );
  const row = result.rows[0];
  return res.status(201).json({
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    sellerName: String(row.seller_name),
    price: Number(row.price),
    receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    featuredUntil: dateString(row.featured_until),
    status: String(row.status),
    createdAt: dateString(row.created_at),
  });
});

router.post("/l4/featured-requests/:requestId/approve", adminOnly, async (req, res) => {
  const pending = await pool.query<Row>(
    "SELECT * FROM l4_featured_requests WHERE id = $1 AND status = 'pending'",
    [req.params.requestId],
  );
  if (!pending.rows[0]) return error(res, 404, "La solicitud ya fue revisada o no existe.");
  const count = await pool.query<Row>(
    `SELECT COUNT(*)::int AS used FROM l4_featured_requests
     WHERE (approved_at AT TIME ZONE 'America/Lima')::date = (now() AT TIME ZONE 'America/Lima')::date`,
  );
  if (Number(count.rows[0].used) >= 5) {
    return error(res, 409, "Ya se alcanzó el máximo de cinco productos destacados por hoy.");
  }
  const settings = await getSettings();
  const until = new Date(Date.now() + Number(settings.featured_duration_hours) * 60 * 60 * 1000);
  await pool.query(
    "UPDATE l4_featured_requests SET status = 'approved', approved_at = now() WHERE id = $1",
    [req.params.requestId],
  );
  await pool.query(
    "UPDATE l4_products SET featured = true, featured_until = $1 WHERE id = $2",
    [until, pending.rows[0].product_id],
  );
  const result = await pool.query<Row>(
    `SELECT f.*, p.title AS product_name, p.price, p.featured_until, seller.display_name AS seller_name
     FROM l4_featured_requests f JOIN l4_products p ON p.id = f.product_id
     JOIN l4_profiles seller ON seller.id = f.seller_id WHERE f.id = $1`,
    [req.params.requestId],
  );
  const row = result.rows[0];
  return res.json({
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    sellerName: String(row.seller_name),
    price: Number(row.price),
    receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    featuredUntil: dateString(row.featured_until),
    status: String(row.status),
    createdAt: dateString(row.created_at),
  });
});

async function getSettings() {
  await pool.query(
    `INSERT INTO l4_admin_settings (id) VALUES ('default')
     ON CONFLICT (id) DO NOTHING`,
  );
  const result = await pool.query<Row>("SELECT * FROM l4_admin_settings WHERE id = 'default'");
  return result.rows[0];
}

async function featuredCountToday() {
  const result = await pool.query<Row>(
    `SELECT COUNT(*)::int AS used FROM l4_featured_requests
     WHERE (approved_at AT TIME ZONE 'America/Lima')::date = (now() AT TIME ZONE 'America/Lima')::date`,
  );
  return Number(result.rows[0]?.used ?? 0);
}

router.get("/l4/admin/overview", adminOnly, async (_req, res) => {
  const [users, reports, pendingFeatures, featuresToday] = await Promise.all([
    pool.query<Row>("SELECT COUNT(*)::int AS total FROM l4_profiles"),
    pool.query<Row>("SELECT COUNT(*)::int AS total FROM l4_reports WHERE status = 'pending'"),
    pool.query<Row>("SELECT COUNT(*)::int AS total FROM l4_featured_requests WHERE status = 'pending'"),
    pool.query<Row>(
      `SELECT COUNT(*)::int AS total FROM l4_featured_requests
       WHERE (approved_at AT TIME ZONE 'America/Lima')::date = (now() AT TIME ZONE 'America/Lima')::date`,
    ),
  ]);
  return res.json({
    userCount: Number(users.rows[0].total),
    pendingReports: Number(reports.rows[0].total),
    pendingFeatured: Number(pendingFeatures.rows[0].total),
    featuredToday: Number(featuresToday.rows[0].total),
    dailyFeaturedLimit: 5,
  });
});

router.get("/l4/admin/users", adminOnly, async (_req, res) => {
  const result = await pool.query<Row>("SELECT * FROM l4_profiles ORDER BY created_at DESC");
  return res.json(result.rows.map(mapProfile));
});

router.patch("/l4/admin/users/:userId/block", adminOnly, async (req, res) => {
  const parsed = BlockUserBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Elige bloquear o desbloquear la cuenta.");
  const result = await pool.query<Row>(
    "UPDATE l4_profiles SET is_blocked = $1 WHERE id = $2 RETURNING *",
    [parsed.data.blocked, req.params.userId],
  );
  if (!result.rows[0]) return error(res, 404, "No encontramos a esa persona.");
  return res.json(mapProfile(result.rows[0]));
});

router.get("/l4/admin/reports", adminOnly, async (_req, res) => {
  const result = await pool.query<Row>(
    "SELECT * FROM l4_reports ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC",
  );
  return res.json(result.rows.map(mapReport));
});

router.patch("/l4/admin/reports/:reportId", adminOnly, async (req, res) => {
  const parsed = ResolveReportBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Elige cómo cerrar el reporte.");
  const result = await pool.query<Row>(
    "UPDATE l4_reports SET status = $1 WHERE id = $2 RETURNING *",
    [parsed.data.status, req.params.reportId],
  );
  if (!result.rows[0]) return error(res, 404, "No encontramos ese reporte.");
  return res.json(mapReport(result.rows[0]));
});

router.delete("/l4/admin/reviews/:reviewId", adminOnly, async (req, res) => {
  const result = await pool.query("DELETE FROM l4_reviews WHERE id = $1", [req.params.reviewId]);
  if (!result.rowCount) return error(res, 404, "No encontramos ese comentario.");
  return res.json({ success: true, message: "Comentario eliminado." });
});

router.patch("/l4/admin/products/:productId/featured", adminOnly, async (req, res) => {
  const parsed = SetProductFeaturedBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Elige si deseas destacar o retirar el producto.");
  const product = await pool.query<Row>("SELECT * FROM l4_products WHERE id = $1", [req.params.productId]);
  if (!product.rows[0]) return error(res, 404, "No encontramos ese producto.");
  let featuredUntil: Date | null = null;
  if (parsed.data.featured) {
    const count = await pool.query<Row>(
      `SELECT COUNT(*)::int AS used FROM l4_featured_requests
       WHERE (approved_at AT TIME ZONE 'America/Lima')::date = (now() AT TIME ZONE 'America/Lima')::date`,
    );
    if (Number(count.rows[0].used) >= 5) {
      return error(res, 409, "Ya se alcanzó el máximo de cinco productos destacados por hoy.");
    }
    const settings = await getSettings();
    featuredUntil = new Date(Date.now() + Number(settings.featured_duration_hours) * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO l4_featured_requests
        (id, product_id, seller_id, status, approved_at)
       VALUES ($1, $2, $3, 'approved', now())`,
      [randomUUID(), req.params.productId, product.rows[0].seller_id],
    );
  }
  await pool.query(
    "UPDATE l4_products SET featured = $1, featured_until = $2 WHERE id = $3",
    [parsed.data.featured, featuredUntil, req.params.productId],
  );
  const updated = await productRows("AND p.id = $1", [req.params.productId], "newest");
  return res.json(mapProduct(updated[0]));
});

router.get("/l4/admin/settings", async (req, res) => {
  const [settings, featuredToday] = await Promise.all([getSettings(), featuredCountToday()]);
  const spreadsheetId = process.env.L4_SPREADSHEET_ID;
  return res.json({
    featuredPrice: Number(settings.featured_price),
    paymentPhone: String(settings.payment_phone),
    featuredDurationHours: Number(settings.featured_duration_hours),
    featuredToday,
    dailyFeaturedLimit: 5,
    sheetConfigured: Boolean(spreadsheetId),
    sheetUrl: hasAdminSession(req) && spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      : null,
  });
});

router.patch("/l4/admin/settings", adminOnly, async (req, res) => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, "Revisa el precio, número de pago y duración.");
  await getSettings();
  const result = await pool.query<Row>(
    `UPDATE l4_admin_settings SET featured_price = $1, payment_phone = $2,
      featured_duration_hours = $3 WHERE id = 'default' RETURNING *`,
    [parsed.data.featuredPrice, parsed.data.paymentPhone, parsed.data.featuredDurationHours],
  );
  const spreadsheetId = process.env.L4_SPREADSHEET_ID;
  return res.json({
    featuredPrice: Number(result.rows[0].featured_price),
    paymentPhone: String(result.rows[0].payment_phone),
    featuredDurationHours: Number(result.rows[0].featured_duration_hours),
    featuredToday: await featuredCountToday(),
    dailyFeaturedLimit: 5,
    sheetConfigured: Boolean(spreadsheetId),
    sheetUrl: spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      : null,
  });
});

router.get("/l4/seller/overview", signedIn, async (req, res) => {
  const profile = await activeProfile(req, res);
  if (!profile) return;
  const monthly = await pool.query<Row>(
    `SELECT to_char(months.month, 'YYYY-MM') AS month,
       COALESCE(SUM(o.total), 0)::float AS sales,
       COUNT(o.id)::int AS order_count
     FROM generate_series(date_trunc('month', now()) - interval '5 months',
       date_trunc('month', now()), interval '1 month') AS months(month)
     LEFT JOIN l4_orders o ON o.seller_id = $1 AND o.confirmed = true
       AND date_trunc('month', o.created_at) = months.month
     GROUP BY months.month ORDER BY months.month`,
    [profile.id],
  );
  const productsSold = await pool.query<Row>(
    `SELECT item->>'productId' AS product_id, SUM((item->>'quantity')::int)::int AS units
     FROM l4_orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
     WHERE o.seller_id = $1 AND o.confirmed = true
     GROUP BY item->>'productId' ORDER BY units DESC LIMIT 5`,
    [profile.id],
  );
  const topProducts = await Promise.all(productsSold.rows.map(async (row) => {
    const found = await productRows("AND p.id = $1", [row.product_id], "newest");
    return found[0] ? mapProduct(found[0]) : null;
  }));
  const buyers = await pool.query<Row>(
    `SELECT buyer_name FROM l4_orders WHERE seller_id = $1 AND confirmed = true
     GROUP BY buyer_name ORDER BY COUNT(*) DESC LIMIT 5`,
    [profile.id],
  );
  const total = await pool.query<Row>(
    `SELECT COUNT(*)::int AS order_count, COALESCE(SUM(total), 0)::float AS sales
     FROM l4_orders WHERE seller_id = $1 AND confirmed = true`,
    [profile.id],
  );
  return res.json({
    monthlySales: monthly.rows.map((row) => ({
      month: String(row.month),
      sales: Number(row.sales),
      orderCount: Number(row.order_count),
    })),
    topProducts: topProducts.filter(Boolean),
    frequentBuyers: buyers.rows.map((row) => String(row.buyer_name)),
    orderCount: Number(total.rows[0].order_count),
    totalSales: Number(total.rows[0].sales),
  });
});

export default router;
