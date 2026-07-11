const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 3000;

const dataDir = path.join(__dirname, "data");
const materiPath = path.join(dataDir, "materi.json");
const quizPath = path.join(dataDir, "quiz.json");
const leaderboardPath = path.join(dataDir, "leaderboard.json");
const uploadDir = path.join(__dirname, "uploads");
const modelUploadDir = path.join(uploadDir, "models");

fs.mkdirSync(modelUploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, modelUploadDir);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "model";

    callback(null, `${Date.now()}-${baseName}${extension}`);
  }
});

const uploadModel = multer({
  storage,
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (![".glb", ".gltf"].includes(extension)) {
      callback(new Error("File model harus berformat .glb atau .gltf"));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

function readJson(filePath, fallback = []) {
  try {
    const rawData = fs.readFileSync(filePath, "utf8");
    return JSON.parse(rawData);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function parseItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMateriPayload(payload, existing = {}) {
  const title = String(payload.title || "").trim();

  if (!title) {
    return null;
  }

  const file = String(payload.file || existing.file || "").trim();
  const modelUrl = String(payload.modelUrl || existing.modelUrl || "").trim();

  return {
    title,
    desc: String(payload.desc || "").trim(),
    file,
    modelUrl,
    items: parseItems(payload.items)
  };
}

function normalizeQuizPayload(payload, existing = {}) {
  const question = String(payload.question || "").trim();
  const answers = parseItems(payload.answers);
  const correct = Number(payload.correct);

  if (!question || answers.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= answers.length) {
    return null;
  }

  return {
    question,
    answers,
    correct,
  };
}

function getNextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function normalizeName(value) {
  const cleanName = String(value || "").trim().replace(/\s+/g, " ");

  if (!cleanName) {
    return "Siswa Tanpa Nama";
  }

  return cleanName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

app.get("/", (req, res) => {
  res.json({
    message: "Backend API Informatika 3D berjalan",
    endpoints: [
      "GET /api/health",
      "GET /api/materi",
      "POST /api/materi",
      "PUT /api/materi/:id",
      "DELETE /api/materi/:id",
      "POST /api/uploads/models",
      "GET /api/quiz",
      "POST /api/quiz",
      "PUT /api/quiz/:id",
      "DELETE /api/quiz/:id",
      "GET /api/leaderboard",
      "POST /api/leaderboard",
      "DELETE /api/leaderboard"
    ]
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Informatika 3D API"
  });
});

app.get("/api/materi", (req, res) => {
  const materi = readJson(materiPath, []);
  res.json(materi);
});

app.post("/api/materi", (req, res) => {
  const materi = readJson(materiPath, []);
  const payload = normalizeMateriPayload(req.body);

  if (!payload) {
    return res.status(400).json({
      message: "Judul materi wajib diisi"
    });
  }

  const newMateri = {
    id: getNextId(materi),
    ...payload
  };

  materi.push(newMateri);
  writeJson(materiPath, materi);

  res.status(201).json({
    message: "Materi berhasil ditambahkan",
    data: newMateri
  });
});

app.put("/api/materi/:id", (req, res) => {
  const materi = readJson(materiPath, []);
  const materiId = Number(req.params.id);
  const index = materi.findIndex((item) => Number(item.id) === materiId);

  if (index < 0) {
    return res.status(404).json({
      message: "Materi tidak ditemukan"
    });
  }

  const payload = normalizeMateriPayload(req.body, materi[index]);

  if (!payload) {
    return res.status(400).json({
      message: "Judul materi wajib diisi"
    });
  }

  const updatedMateri = {
    ...materi[index],
    ...payload,
    id: materiId
  };

  materi[index] = updatedMateri;
  writeJson(materiPath, materi);

  res.json({
    message: "Materi berhasil diperbarui",
    data: updatedMateri
  });
});

app.delete("/api/materi/:id", (req, res) => {
  const materi = readJson(materiPath, []);
  const materiId = Number(req.params.id);
  const nextMateri = materi.filter((item) => Number(item.id) !== materiId);

  if (nextMateri.length === materi.length) {
    return res.status(404).json({
      message: "Materi tidak ditemukan"
    });
  }

  writeJson(materiPath, nextMateri);

  res.json({
    message: "Materi berhasil dihapus"
  });
});

app.post("/api/uploads/models", (req, res) => {
  uploadModel.single("model")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "File model wajib diunggah"
      });
    }

    res.status(201).json({
      message: "Model 3D berhasil diunggah",
      fileName: req.file.filename,
      url: `/uploads/models/${req.file.filename}`
    });
  });
});

app.get("/api/quiz", (req, res) => {
  const quiz = readJson(quizPath, []);
  res.json(quiz);
});

app.post("/api/quiz", (req, res) => {
  const quiz = readJson(quizPath, []);
  const payload = normalizeQuizPayload(req.body);

  if (!payload) {
    return res.status(400).json({
      message: "Pertanyaan, minimal 2 jawaban, dan indeks jawaban benar wajib valid"
    });
  }

  const newQuestion = {
    id: getNextId(quiz),
    ...payload
  };

  quiz.push(newQuestion);
  writeJson(quizPath, quiz);

  res.status(201).json({
    message: "Soal berhasil ditambahkan",
    data: newQuestion
  });
});

app.put("/api/quiz/:id", (req, res) => {
  const quiz = readJson(quizPath, []);
  const questionId = Number(req.params.id);
  const index = quiz.findIndex((item) => Number(item.id) === questionId);

  if (index < 0) {
    return res.status(404).json({
      message: "Soal tidak ditemukan"
    });
  }

  const payload = normalizeQuizPayload(req.body, quiz[index]);

  if (!payload) {
    return res.status(400).json({
      message: "Pertanyaan, minimal 2 jawaban, dan indeks jawaban benar wajib valid"
    });
  }

  const updatedQuestion = {
    ...quiz[index],
    ...payload,
    id: questionId
  };

  quiz[index] = updatedQuestion;
  writeJson(quizPath, quiz);

  res.json({
    message: "Soal berhasil diperbarui",
    data: updatedQuestion
  });
});

app.delete("/api/quiz/:id", (req, res) => {
  const quiz = readJson(quizPath, []);
  const questionId = Number(req.params.id);
  const nextQuiz = quiz.filter((item) => Number(item.id) !== questionId);

  if (nextQuiz.length === quiz.length) {
    return res.status(404).json({
      message: "Soal tidak ditemukan"
    });
  }

  writeJson(quizPath, nextQuiz);

  res.json({
    message: "Soal berhasil dihapus"
  });
});

app.get("/api/leaderboard", (req, res) => {
  const leaderboard = readJson(leaderboardPath, []);
  const sortedLeaderboard = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);

  res.json(sortedLeaderboard);
});

app.post("/api/leaderboard", (req, res) => {
  const { name, score, total } = req.body;

  if (score === undefined || total === undefined) {
    return res.status(400).json({
      message: "Field score dan total wajib dikirim"
    });
  }

  const leaderboard = readJson(leaderboardPath, []);
  const studentName = normalizeName(name);

  const newEntry = {
    name: studentName,
    score: Number(score),
    total: Number(total),
    savedAt: new Date().toISOString()
  };

  const existingIndex = leaderboard.findIndex(
    (entry) => entry.name.toLowerCase() === studentName.toLowerCase()
  );

  if (existingIndex >= 0) {
    if (newEntry.score >= leaderboard[existingIndex].score) {
      leaderboard[existingIndex] = newEntry;
    }
  } else {
    leaderboard.push(newEntry);
  }

  const sortedLeaderboard = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
  writeJson(leaderboardPath, sortedLeaderboard);

  res.status(201).json({
    message: "Skor berhasil disimpan",
    data: newEntry,
    leaderboard: sortedLeaderboard
  });
});

app.delete("/api/leaderboard", (req, res) => {
  writeJson(leaderboardPath, []);

  res.json({
    message: "Leaderboard berhasil direset"
  });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
