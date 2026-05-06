import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Redirigir la raíz a home_v2.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home_v2.html"));
});

// Redirigir dashboard a dashboard_v2.html
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard_v2.html"));
});

// Redirigir home a home_v2.html
app.get("/home.html", (req, res) => {
  res.sendFile(path.join(__dirname, "home_v2.html"));
});

// 🔥 CONFIGURACIÓN DE CLOUDFLARE R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// 🔥 CONFIGURAR MULTER PARA MEMORIA
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// 🔥 FIREBASE ADMIN INITIALIZATION
let serviceAccount = null;
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
} else if (process.env.FIREBASE_CONFIG_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
  } catch (error) {
    console.error("❌ Error al parsear FIREBASE_CONFIG_JSON");
  }
}

if (!serviceAccount) {
  console.error("❌ Error: No se encontró configuración de Firebase");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin inicializado");
} catch (error) {
  console.error("❌ Error al inicializar Firebase:", error.message);
  process.exit(1);
}

const db = admin.firestore();

// CONFIGURACIÓN DE COMISIÓN
const OWNER_COMMISSION_PERCENTAGE = parseFloat(process.env.OWNER_COMMISSION || "20");
const CREATOR_PERCENTAGE = 100 - OWNER_COMMISSION_PERCENTAGE;

// 🔐 VALIDAR PAGO CON PAYPAL
async function validatePayPalOrder(orderId) {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || "sandbox";
    
    const baseUrl = mode === "live" 
      ? "https://api.paypal.com" 
      : "https://api.sandbox.paypal.com";

    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const authData = await authResponse.json();
    if (!authData.access_token) {
      throw new Error("No se pudo obtener token de PayPal");
    }

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authData.access_token}`
      }
    });

    const orderData = await orderResponse.json();
    
    if (orderData.status === "COMPLETED" && orderData.payer) {
      return {
        valid: true,
        amount: parseFloat(orderData.purchase_units[0].amount.value),
        payerEmail: orderData.payer.email_address
      };
    }

    return { valid: false };
  } catch (error) {
    console.error("Error validando PayPal:", error);
    return { valid: false };
  }
}

// 🔐 VALIDAR PAGO CON STRIPE
async function validateStripePayment(paymentIntentId) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return { valid: false };

    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${stripeKey}`
      }
    });

    const data = await response.json();
    
    if (data.status === "succeeded") {
      return {
        valid: true,
        amount: data.amount / 100,
        payerEmail: data.receipt_email
      };
    }

    return { valid: false };
  } catch (error) {
    console.error("Error validando Stripe:", error);
    return { valid: false };
  }
}

// 🔐 VALIDAR PAGO CON MERCADO PAGO
async function validateMercadoPagoPayment(paymentId) {
  try {
    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!mpToken) return { valid: false };

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mpToken}`
      }
    });

    const data = await response.json();
    
    if (data.status === "approved") {
      return {
        valid: true,
        amount: data.transaction_amount,
        payerEmail: data.payer.email
      };
    }

    return { valid: false };
  } catch (error) {
    console.error("Error validando Mercado Pago:", error);
    return { valid: false };
  }
}

// 📱 GET /api/media-user - Obtener contenido del usuario autenticado
app.get("/api/media-user", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ ok: false, error: "userId requerido" });
    }
    const snap = await db.collection("media").where("uploadedBy", "==", userId).get();
    const media = [];
    snap.forEach(doc => {
      const data = doc.data();
      media.push({
        id: doc.id,
        ...data,
        views: data.views || 0,
        comments: data.commentsCount || 0
      });
    });
    res.json({ ok: true, media });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 📱 GET /api/media-public - Obtener contenido público
app.get("/api/media-public", async (req, res) => {
  try {
    const snap = await db.collection("media").where("isPublic", "==", true).get();
    const media = [];
    snap.forEach(doc => {
      const data = doc.data();
      media.push({
        id: doc.id,
        ...data,
        views: data.views || 0,
        comments: data.commentsCount || 0
      });
    });
    res.json({ ok: true, media });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 📱 GET /api/channel/:creatorId - Obtener contenido de un canal específico
app.get("/api/channel/:creatorId", async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { userId } = req.query;

    let isSubscribed = false;
    if (userId && userId !== "anonymous") {
      const subscriptionSnap = await db.collection("subscriptions")
        .where("subscriberId", "==", userId)
        .where("creatorId", "==", creatorId)
        .where("active", "==", true)
        .get();
      isSubscribed = !subscriptionSnap.empty;
    }

    const snap = await db.collection("media").where("uploadedBy", "==", creatorId).get();
    const media = [];

    snap.forEach(doc => {
      const data = doc.data();
      
      if (data.isPublic) {
        media.push({
          id: doc.id,
          ...data,
          views: data.views || 0,
          comments: data.commentsCount || 0,
          locked: false
        });
      } else {
        if (userId === creatorId) {
          media.push({
            id: doc.id,
            ...data,
            views: data.views || 0,
            comments: data.commentsCount || 0,
            locked: false
          });
        } else if (isSubscribed) {
          media.push({
            id: doc.id,
            ...data,
            views: data.views || 0,
            comments: data.commentsCount || 0,
            locked: false
          });
        } else {
          media.push({
            id: doc.id,
            title: data.title,
            description: "Contenido exclusivo para suscriptores",
            locked: true
          });
        }
      }
    });

    res.json({ ok: true, media });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🗑️ DELETE /api/media/:mediaId - Eliminar contenido del usuario
app.delete("/api/media/:mediaId", async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { userId } = req.body;

    if (!mediaId || !userId) {
      return res.status(400).json({ ok: false, error: "mediaId y userId requeridos" });
    }

    const mediaRef = db.collection("media").doc(mediaId);
    const mediaDoc = await mediaRef.get();

    if (!mediaDoc.exists) {
      return res.status(404).json({ ok: false, error: "Media no encontrada" });
    }

    const mediaData = mediaDoc.data();
    if (mediaData.uploadedBy !== userId) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para eliminar este contenido" });
    }

    const url = mediaData.url;
    const urlParts = url.split("/");
    const key = urlParts.slice(3).join("/");

    try {
      const deleteParams = {
        Bucket: R2_BUCKET_NAME,
        Key: key
      };
      await s3Client.send(new DeleteObjectCommand(deleteParams));
    } catch (s3Error) {
      console.warn("Advertencia: Error al eliminar de R2:", s3Error.message);
    }

    await mediaRef.delete();
    res.json({ ok: true, message: "Contenido eliminado correctamente" });
  } catch (error) {
    console.error("Error en /api/media/:mediaId DELETE:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 ENDPOINT PARA SUBIR A CLOUDFLARE R2
app.post("/upload-r2", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No se envió archivo" });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const key = `uploads/${req.body.userId || 'anonymous'}/${fileName}`;

    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    
    const fileUrl = `${R2_PUBLIC_URL}/${key}`;

    const mediaRef = await db.collection("media").add({
      url: fileUrl,
      type: req.file.mimetype,
      isPublic: req.body.isPublic === "true" ? true : false,
      uploadedBy: req.body.userId || "unknown",
      uploadedAt: new Date().toISOString(),
      title: req.body.title || req.file.originalname,
      description: req.body.description || "",
      storageType: "cloudflare-r2",
      fileSize: req.file.size,
      views: 0,
      commentsCount: 0
    });

    res.json({
      ok: true,
      message: "Archivo subido a R2 y registrado en Firebase",
      url: fileUrl,
      mediaId: mediaRef.id
    });
  } catch (error) {
    console.error("Error en /upload-r2:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 👁️ POST /api/increment-views - Incrementar contador de visitas
app.post("/api/increment-views", async (req, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId) {
      return res.status(400).json({ ok: false, error: "mediaId requerido" });
    }

    const mediaRef = db.collection("media").doc(mediaId);
    const doc = await mediaRef.get();

    if (!doc.exists) {
      return res.status(404).json({ ok: false, error: "Media no encontrada" });
    }

    const currentViews = doc.data().views || 0;
    await mediaRef.update({ views: currentViews + 1 });

    res.json({ ok: true, views: currentViews + 1 });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 💬 POST /api/add-comment - Añadir comentario
app.post("/api/add-comment", async (req, res) => {
  try {
    const { mediaId, userId, userName, text } = req.body;

    if (!mediaId || !userId || !text) {
      return res.status(400).json({ ok: false, error: "Campos requeridos faltantes" });
    }

    const comment = {
      userId,
      userName: userName || "Anónimo",
      text,
      createdAt: new Date().toISOString(),
      likes: 0
    };

    await db.collection("media").doc(mediaId).collection("comments").add(comment);

    const mediaRef = db.collection("media").doc(mediaId);
    const mediaDoc = await mediaRef.get();
    const currentComments = mediaDoc.data().commentsCount || 0;
    await mediaRef.update({ commentsCount: currentComments + 1 });

    res.json({ ok: true, message: "Comentario añadido", comment });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 💬 GET /api/comments/:mediaId - Obtener comentarios de un contenido
app.get("/api/comments/:mediaId", async (req, res) => {
  try {
    const { mediaId } = req.params;
    const snap = await db.collection("media").doc(mediaId).collection("comments").orderBy("createdAt", "desc").get();
    
    const comments = [];
    snap.forEach(doc => {
      comments.push({ id: doc.id, ...doc.data() });
    });

    res.json({ ok: true, comments });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 💳 POST /api/subscribe-channel - Suscribirse a un canal (CON VALIDACIÓN DE PAGO REAL)
app.post("/api/subscribe-channel", async (req, res) => {
  try {
    const { subscriberId, creatorId, orderId, paymentMethod } = req.body;

    if (!subscriberId || !creatorId || !orderId) {
      return res.status(400).json({ ok: false, error: "Campos requeridos faltantes" });
    }

    let paymentValid = false;
    let paymentAmount = parseFloat(process.env.VIP_PRICE || "9.99");

    if (paymentMethod === "paypal") {
      const validation = await validatePayPalOrder(orderId);
      paymentValid = validation.valid && validation.amount >= paymentAmount;
    } else if (paymentMethod === "stripe") {
      const validation = await validateStripePayment(orderId);
      paymentValid = validation.valid && validation.amount >= (paymentAmount * 100);
    } else if (paymentMethod === "mercadopago") {
      const validation = await validateMercadoPagoPayment(orderId);
      paymentValid = validation.valid && validation.amount >= paymentAmount;
    }

    if (!paymentValid) {
      return res.status(400).json({ ok: false, error: "Pago no válido o no completado" });
    }

    const existingSnap = await db.collection("subscriptions")
      .where("subscriberId", "==", subscriberId)
      .where("creatorId", "==", creatorId)
      .get();

    if (!existingSnap.empty) {
      const existingSub = existingSnap.docs[0].data();
      if (existingSub.active && new Date(existingSub.expiresAt) > new Date()) {
        return res.status(400).json({ ok: false, error: "Ya estás suscrito a este canal" });
      }
    }

    const subscriptionRef = await db.collection("subscriptions").add({
      subscriberId,
      creatorId,
      orderId,
      paymentMethod,
      subscribedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      active: true
    });

    const vipPrice = parseFloat(process.env.VIP_PRICE || "9.99");
    const ownerEarnings = (vipPrice * OWNER_COMMISSION_PERCENTAGE) / 100;
    const creatorEarnings = (vipPrice * CREATOR_PERCENTAGE) / 100;

    await db.collection("transactions").add({
      subscriberId,
      creatorId,
      amount: vipPrice,
      ownerEarnings,
      creatorEarnings,
      orderId,
      paymentMethod,
      status: "completed",
      createdAt: new Date().toISOString()
    });

    const creatorRef = db.collection("users").doc(creatorId);
    const creatorDoc = await creatorRef.get();
    const currentBalance = (creatorDoc.data()?.balance || 0) + creatorEarnings;
    await creatorRef.update({ balance: currentBalance });

    const ownerRef = db.collection("users").doc("owner");
    const ownerDoc = await ownerRef.get();
    if (ownerDoc.exists) {
      const ownerBalance = (ownerDoc.data()?.balance || 0) + ownerEarnings;
      await ownerRef.update({ balance: ownerBalance });
    } else {
      await ownerRef.set({ balance: ownerEarnings, role: "owner" });
    }

    res.json({ 
      ok: true, 
      message: "Suscripción creada exitosamente", 
      subscriptionId: subscriptionRef.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 📊 GET /api/user-stats/:userId - Obtener estadísticas del usuario
app.get("/api/user-stats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};

    const subscribersSnap = await db.collection("subscriptions")
      .where("creatorId", "==", userId)
      .where("active", "==", true)
      .get();
    const subscriberCount = subscribersSnap.size;

    const transactionsSnap = await db.collection("transactions")
      .where("creatorId", "==", userId)
      .get();
    const totalEarnings = transactionsSnap.docs.reduce((sum, doc) => sum + (doc.data().creatorEarnings || 0), 0);

    const mediaSnap = await db.collection("media").where("uploadedBy", "==", userId).get();
    const totalViews = mediaSnap.docs.reduce((sum, doc) => sum + (doc.data().views || 0), 0);

    res.json({
      ok: true,
      stats: {
        balance: userData.balance || 0,
        subscribers: subscriberCount,
        totalEarnings,
        totalViews,
        contentCount: mediaSnap.size
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 📊 GET /api/owner-stats - Obtener estadísticas del dueño
app.get("/api/owner-stats", async (req, res) => {
  try {
    const ownerDoc = await db.collection("users").doc("owner").get();
    const ownerData = ownerDoc.data() || {};

    const transactionsSnap = await db.collection("transactions").get();
    const totalRevenue = transactionsSnap.docs.reduce((sum, doc) => sum + (doc.data().ownerEarnings || 0), 0);

    const usersSnap = await db.collection("users").get();
    const totalUsers = usersSnap.size;

    const subscriptionsSnap = await db.collection("subscriptions").where("active", "==", true).get();
    const activeSubscriptions = subscriptionsSnap.size;

    res.json({
      ok: true,
      stats: {
        balance: ownerData.balance || 0,
        totalRevenue,
        totalUsers,
        activeSubscriptions,
        commissionPercentage: OWNER_COMMISSION_PERCENTAGE
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔐 GET /api/check-subscription - Verificar si el usuario está suscrito a un canal
app.get("/api/check-subscription/:userId/:creatorId", async (req, res) => {
  try {
    const { userId, creatorId } = req.params;

    const snap = await db.collection("subscriptions")
      .where("subscriberId", "==", userId)
      .where("creatorId", "==", creatorId)
      .where("active", "==", true)
      .get();

    if (snap.empty) {
      return res.json({ ok: true, subscribed: false });
    }

    const subscription = snap.docs[0].data();
    const isExpired = new Date(subscription.expiresAt) < new Date();

    res.json({ 
      ok: true, 
      subscribed: !isExpired,
      expiresAt: subscription.expiresAt
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    config: {
      paypalClientId: process.env.PAYPAL_CLIENT_ID || "AVxAbIDajf-qYOp-mGm6RSGrkqfB6HHk61_QsjUs3S7aBtAYjByJX1SXCbkwKzChYHGgkyuTSU7KznGJ",
      paypalMode: process.env.PAYPAL_MODE || "sandbox",
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      mercadoPagoPublicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || "",
      vipPrice: process.env.VIP_PRICE || "9.99",
      vipDurationDays: process.env.VIP_DURATION_DAYS || "30",
      ownerCommission: OWNER_COMMISSION_PERCENTAGE
    }
  });
});

app.get("/api/media", async (req, res) => {
  try {
    const snap = await db.collection("media").get();
    const media = [];
    snap.forEach(doc => media.push({ id: doc.id, ...doc.data() }));
    res.json({ ok: true, media: media });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/verify-paypal", async (req, res) => {
  try {
    const { email, orderId } = req.body;
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    const batch = db.batch();
    snap.forEach((doc) => {
      batch.update(doc.ref, {
        vip: true,
        vip_expire: Date.now() + (30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: new Date().toISOString(),
        lastOrderId: orderId || null
      });
    });
    await batch.commit();
    res.json({ ok: true, message: "VIP activado" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/check-vip", async (req, res) => {
  try {
    const { email } = req.body;
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.json({ ok: true, vip: false });
    let isVIP = false;
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.vip && data.vip_expire && Date.now() < data.vip_expire) isVIP = true;
      else if (data.vip && !data.vip_expire) isVIP = true;
    });
    res.json({ ok: true, vip: isVIP });
  } catch (error) {
    res.status(500).json({ ok: false, vip: false });
  }
});

app.get("/admin-users", async (req, res) => {
  try {
    const users = [];
    const snap = await db.collection("users").get();
    snap.forEach((doc) => users.push({ uid: doc.id, ...doc.data() }));
    res.json({ ok: true, users: users });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor en puerto ${PORT}`);
});
