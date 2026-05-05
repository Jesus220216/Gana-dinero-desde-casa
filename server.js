// 🚀 MODO IMPERIO - SERVER COMPLETO

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 🔐 ENV (CONFIGURA ESTO EN RENDER)
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET || "videos-vip";
const SECRET = process.env.SECRET || "ultra-secret-key";

// 🔥 R2 CLIENT
const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY
  }
});

// 🔥 MULTER
const upload = multer({ dest: "tmp/" });

// 🔥 FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔐 TOKEN
function generateToken(userId, key) {
  return crypto.createHmac("sha256", SECRET)
    .update(userId + key)
    .digest("hex");
}

// 🚀 SUBIR A R2
app.post("/upload-r2", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const key = Date.now() + "-" + file.originalname;

    const fileStream = fs.createReadStream(file.path);

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: file.mimetype
    }));

    fs.unlinkSync(file.path);

    await db.collection("media").add({
      key,
      type: file.mimetype,
      vip: req.body.vip === "true",
      ownerId: req.body.userId,
      createdAt: new Date().toISOString()
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🔐 OBTENER VIDEO SEGURO
app.get("/secure-media", async (req, res) => {
  try {
    const { key, token, userId } = req.query;

    const valid = generateToken(userId, key);

    if (token !== valid) {
      return res.status(403).json({ ok: false });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 });

    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// 🔐 GENERAR TOKEN
app.get("/generate-token", (req, res) => {
  const { userId, key } = req.query;
  const token = generateToken(userId, key);
  res.json({ token });
});

// 💰 ACTIVAR VIP (SIMPLIFICADO)
app.post("/activate-vip", async (req, res) => {
  const { email } = req.body;

  const snap = await db.collection("users").where("email", "==", email).get();

  snap.forEach(doc => {
    doc.ref.update({
      vip: true,
      vip_expire: Date.now() + (30 * 24 * 60 * 60 * 1000)
    });
  });

  res.json({ ok: true });
});

// 💸 REFERIDOS
app.post("/referral", async (req, res) => {
  const { referrer, user } = req.body;

  await db.collection("referrals").add({
    referrer,
    user,
    commission: 0,
    createdAt: new Date().toISOString()
  });

  res.json({ ok: true });
});

// 📊 ADMIN
app.get("/admin", async (req, res) => {
  const users = await db.collection("users").get();
  const media = await db.collection("media").get();

  res.json({
    users: users.size,
    media: media.size
  });
});

// 🔥 START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 MODO IMPERIO ACTIVO en puerto", PORT);
});
