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
    await db.collection("media").add({
      url: fileUrl,
      type: req.file.mimetype,
      vip: true,
      uploadedBy: req.body.userId || "unknown",
      uploadedAt: new Date().toISOString(),
      title: req.body.title || req.file.originalname,
      storageType: "cloudflare-r2",
      fileSize: req.file.size
    });

    res.json({
      ok: true,
      message: "Archivo subido a R2 y registrado en Firebase",
      url: fileUrl
    });
  } catch (error) {
    console.error("Error en /upload-r2:", error);
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
