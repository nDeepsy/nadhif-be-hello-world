const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const dataDir = path.join(__dirname, "data");
const materiPath = path.join(dataDir, "materi.json");
const quizPath = path.join(dataDir, "quiz.json");
const leaderboardPath = path.join(dataDir, "leaderboard.json");

app.use(cors());
app.use(express.json());

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
      "GET /api/quiz",
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

app.get("/api/quiz", (req, res) => {
  const quiz = readJson(quizPath, []);
  res.json(quiz);
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