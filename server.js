import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// 🔥 CREAR CARPETA DE UPLOADS SI NO EXISTE
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 🔥 CONFIGURAR MULTER PARA SUBIDAS LOCALES
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp"
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"));
    }
  }
});

// 🔥 FIREBASE ADMIN INITIALIZATION (REPARADO)
let serviceAccount;

if (process.env.FIREBASE_PRIVATE_KEY) {
  // ✅ PRODUCCIÓN (Render)
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
} else {
  // ✅ LOCAL (archivo JSON)
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ No hay Firebase config (ni ENV ni JSON)");
    process.exit(1);
  }

  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔥 ENDPOINT DE SUBIDA LOCAL
app.post("/upload-local", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No se envió archivo" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;

    await admin.firestore().collection("media").add({
      url: fileUrl,
      type: fileType,
      vip: true,
      uploadedBy: req.body.userId,
      uploadedAt: new Date().toISOString(),
      title: req.body.title || req.file.originalname,
      storageType: "local",
      fileSize: req.file.size
    });

    res.json({
      ok: true,
      message: "Archivo subido exitosamente",
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error("Error en /upload-local:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 ENDPOINT DE SUBIDA A FIREBASE (OPCIONAL)
app.post("/upload-firebase", async (req, res) => {
  try {
    const { url, type, userId, title } = req.body;

    if (!url || !type) {
      return res.status(400).json({ ok: false, error: "Faltan parámetros" });
    }

    await admin.firestore().collection("media").add({
      url: url,
      type: type,
      vip: true,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
      title: title || "Sin título",
      storageType: "firebase"
    });

    res.json({ ok: true, message: "Contenido registrado en Firebase" });
  } catch (error) {
    console.error("Error en /upload-firebase:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 OBTENER LISTA DE MEDIOS
app.get("/api/media", async (req, res) => {
  try {
    const snap = await admin.firestore().collection("media").get();
    const media = [];

    snap.forEach(doc => {
      media.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ ok: true, media: media });
  } catch (error) {
    console.error("Error en /api/media:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 VERIFY PAYPAL PAYMENT AND ACTIVATE VIP
app.post("/verify-paypal", async (req, res) => {
  try {
    const { email, orderId } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, error: "Email requerido" });
    }

    const snap = await db.collection("users")
      .where("email", "==", email)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }

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

    res.json({ 
      ok: true, 
      message: "VIP activado exitosamente",
      expiresIn: "30 días"
    });
  } catch (error) {
    console.error("Error en /verify-paypal:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 GET USER VIP STATUS
app.post("/check-vip", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, vip: false });
    }

    const snap = await db.collection("users")
      .where("email", "==", email)
      .get();

    if (snap.empty) {
      return res.json({ ok: true, vip: false });
    }

    let isVIP = false;
    snap.forEach((doc) => {
      const data = doc.data();
      
      if (data.vip && data.vip_expire) {
        if (Date.now() < data.vip_expire) {
          isVIP = true;
        } else {
          doc.ref.update({ vip: false });
        }
      } else if (data.vip) {
        isVIP = true;
      }
    });

    res.json({ ok: true, vip: isVIP });
  } catch (error) {
    console.error("Error en /check-vip:", error);
    res.status(500).json({ ok: false, vip: false, error: error.message });
  }
});

// 🔥 GET ALL USERS (ADMIN)
app.get("/admin-users", async (req, res) => {
  try {
    const users = [];
    const snap = await db.collection("users").get();

    snap.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email,
        vip: data.vip || false,
        vip_expire: data.vip_expire || null,
        createdAt: data.createdAt || null,
        lastPaymentDate: data.lastPaymentDate || null
      });
    });

    res.json({ ok: true, users: users, total: users.length });
  } catch (error) {
    console.error("Error en /admin-users:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 GET MEDIA STATS
app.get("/media-stats", async (req, res) => {
  try {
    const mediaSnap = await db.collection("media").get();
    const usersSnap = await db.collection("users").get();

    let totalVIPUsers = 0;
    let totalMedia = mediaSnap.size;
    let totalUsers = usersSnap.size;

    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.vip) {
        totalVIPUsers++;
      }
    });

    res.json({
      ok: true,
      stats: {
        totalUsers: totalUsers,
        totalVIPUsers: totalVIPUsers,
        totalMedia: totalMedia,
        vipPercentage: totalUsers > 0 ? ((totalVIPUsers / totalUsers) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error("Error en /media-stats:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 🔥 HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando correctamente" });
});

// 🔥 ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(400).json({ ok: false, error: "Archivo demasiado grande (máximo 500MB)" });
    }
    return res.status(400).json({ ok: false, error: err.message });
  }
  
  res.status(500).json({ ok: false, error: "Error interno del servidor" });
});

// 🔥 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
});
