const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    message: "Hello World Backend",
    status: "success"
  }));
});

server.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`);
});
