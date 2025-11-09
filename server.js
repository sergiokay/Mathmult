import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// --- Obtener lista de fuentes ---
app.get("/api/fonts", (req, res) => {
  const fontsDir = path.join(__dirname, "fuentes");
  fs.readdir(fontsDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Error al leer la carpeta de fuentes." });
    const fontFiles = files.filter(f => f.match(/\.(ttf|otf|woff2?)$/i));
    res.json(fontFiles);
  });
});

// --- Obtener lista de vectores ---
app.get("/api/vectors", (req, res) => {
  const vectorsDir = path.join(__dirname, "vectores");
  fs.readdir(vectorsDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Error al leer la carpeta de vectores." });
    const svgFiles = files.filter(f => f.match(/\.svg$/i));
    res.json(svgFiles);
  });
});

// --- Leer precios ---
app.get("/api/precios", (req, res) => {
  fs.readFile(path.join(__dirname, "precios.json"), "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Error al leer precios." });
    res.json(JSON.parse(data));
  });
});

// --- Guardar precios desde admin ---
app.post("/api/precios", (req, res) => {
  fs.writeFile(path.join(__dirname, "precios.json"), JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).json({ error: "Error al guardar precios." });
    res.json({ message: "Precios actualizados con éxito." });
  });
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
