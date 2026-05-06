import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
  endpoint: process.env.R2_ENDPOINT, // Ejemplo: https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Ejemplo: https://pub-xxx.r2.dev o tu dominio

// 🔥 CONFIGURAR MULTER PARA MEMORIA (Para subir directo a R2)
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

// 🔥 ENDPOINT PARA SUBIR A CLOUDFLARE R2
app.post("/upload-r2", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No se envió archivo" });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const key = `uploads/${req.body.userId || 'anonymous'}/${fileName}`;

    // Subir a R2
    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    
    const fileUrl = `${R2_PUBLIC_URL}/${key}`;

    // Guardar referencia en Firebase Firestore
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

    // Añadir comentario a la subcolección
    await db.collection("media").doc(mediaId).collection("comments").add(comment);

    // Incrementar contador de comentarios
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

// Mantener los otros endpoints de Firebase...
app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    config: {
      paypalClientId: process.env.PAYPAL_CLIENT_ID || "AVxAbIDajf-qYOp-mGm6RSGrkqfB6HHk61_QsjUs3S7aBtAYjByJX1SXCbkwKzChYHGgkyuTSU7KznGJ",
      paypalMode: process.env.PAYPAL_MODE || "sandbox",
      vipPrice: process.env.VIP_PRICE || "9.99",
      vipDurationDays: process.env.VIP_DURATION_DAYS || "30"
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
