const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "..", "uploads", "models");
fs.mkdirSync(outputDir, { recursive: true });

const cubePositions = [
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
  -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
  0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
  -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
];

const cubeNormals = [
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
];

const cubeIndices = [
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23,
];

const colorMap = {
  black: [0.03, 0.04, 0.06, 1],
  charcoal: [0.10, 0.13, 0.18, 1],
  screen: [0.02, 0.19, 0.36, 1],
  glow: [0.06, 0.67, 0.50, 1],
  blue: [0.07, 0.25, 0.70, 1],
  silver: [0.74, 0.78, 0.83, 1],
  white: [0.93, 0.95, 0.97, 1],
  green: [0.10, 0.58, 0.32, 1],
  orange: [0.90, 0.43, 0.12, 1],
  board: [0.02, 0.35, 0.22, 1],
  circuit: [0.48, 0.88, 0.58, 1],
  purple: [0.30, 0.20, 0.58, 1],
};

function align4(buffer, paddingByte = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, paddingByte)]) : buffer;
}

function createGlb(name, parts) {
  const positionBuffer = Buffer.from(new Float32Array(cubePositions).buffer);
  const normalBuffer = Buffer.from(new Float32Array(cubeNormals).buffer);
  const indexBuffer = Buffer.from(new Uint16Array(cubeIndices).buffer);

  const buffers = [];
  const bufferViews = [];
  let byteOffset = 0;

  for (const buffer of [positionBuffer, normalBuffer, indexBuffer]) {
    const aligned = align4(buffer);
    buffers.push(aligned);
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: buffer.length,
      target: buffer === indexBuffer ? 34963 : 34962,
    });
    byteOffset += aligned.length;
  }

  const bin = Buffer.concat(buffers);
  const materialNames = [...new Set(parts.map((part) => part.color || "charcoal"))];
  const materials = materialNames.map((materialName) => ({
    name: materialName,
    pbrMetallicRoughness: {
      baseColorFactor: colorMap[materialName] || colorMap.charcoal,
      metallicFactor: ["silver", "black", "charcoal"].includes(materialName) ? 0.25 : 0.05,
      roughnessFactor: 0.55,
    },
  }));

  const meshes = materialNames.map((materialName, index) => ({
    name: `${materialName} box`,
    primitives: [{
      attributes: {
        POSITION: 0,
        NORMAL: 1,
      },
      indices: 2,
      material: index,
    }],
  }));

  const nodes = parts.map((part) => ({
    name: part.name,
    mesh: materialNames.indexOf(part.color || "charcoal"),
    translation: part.translation,
    scale: part.scale,
    rotation: part.rotation,
  })).map((node) => {
    if (!node.rotation) delete node.rotation;
    return node;
  });

  const gltf = {
    asset: {
      version: "2.0",
      generator: "Informatika 3D hardware generator",
    },
    scene: 0,
    scenes: [{ name, nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 24,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: 36,
        type: "SCALAR",
      },
    ],
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };

  const json = align4(Buffer.from(JSON.stringify(gltf), "utf8"), 0x20);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  fs.writeFileSync(path.join(outputDir, `${name}.glb`), Buffer.concat([header, jsonHeader, json, binHeader, bin]));
}

function pcSet() {
  return [
    { name: "motherboard", color: "board", translation: [0, 0, 0], scale: [2.10, 0.12, 1.42] },
    { name: "cpu socket", color: "silver", translation: [-0.42, 0.11, 0.05], scale: [0.58, 0.08, 0.50] },
    { name: "cpu chip", color: "blue", translation: [-0.42, 0.18, 0.05], scale: [0.38, 0.08, 0.32] },
    { name: "cooler base", color: "black", translation: [-0.42, 0.29, 0.05], scale: [0.46, 0.12, 0.40] },
    { name: "cooler stripe 1", color: "silver", translation: [-0.60, 0.38, 0.05], scale: [0.04, 0.20, 0.40] },
    { name: "cooler stripe 2", color: "silver", translation: [-0.48, 0.38, 0.05], scale: [0.04, 0.20, 0.40] },
    { name: "cooler stripe 3", color: "silver", translation: [-0.36, 0.38, 0.05], scale: [0.04, 0.20, 0.40] },
    { name: "cooler stripe 4", color: "silver", translation: [-0.24, 0.38, 0.05], scale: [0.04, 0.20, 0.40] },
    { name: "ram slot 1", color: "black", translation: [0.48, 0.16, -0.34], scale: [0.12, 0.16, 0.88] },
    { name: "ram stick 1", color: "green", translation: [0.48, 0.34, -0.34], scale: [0.09, 0.22, 0.78] },
    { name: "ram slot 2", color: "black", translation: [0.72, 0.16, -0.34], scale: [0.12, 0.16, 0.88] },
    { name: "ram stick 2", color: "green", translation: [0.72, 0.34, -0.34], scale: [0.09, 0.22, 0.78] },
    { name: "gpu slot", color: "black", translation: [0.20, 0.15, 0.47], scale: [1.25, 0.10, 0.12] },
    { name: "gpu card", color: "purple", translation: [0.20, 0.34, 0.47], scale: [1.10, 0.32, 0.12] },
    { name: "power connector", color: "orange", translation: [0.93, 0.18, 0.46], scale: [0.22, 0.16, 0.22] },
    { name: "circuit line 1", color: "circuit", translation: [-0.05, 0.20, -0.02], scale: [1.22, 0.03, 0.03] },
    { name: "circuit line 2", color: "circuit", translation: [0.08, 0.20, -0.18], scale: [0.03, 0.03, 0.78] },
    { name: "circuit line 3", color: "circuit", translation: [-0.75, 0.20, 0.40], scale: [0.48, 0.03, 0.03] },
    { name: "bios battery", color: "silver", translation: [-0.85, 0.18, -0.45], scale: [0.28, 0.06, 0.28] },
  ];
}

createGlb("cpu", pcSet());

createGlb("input", [
  { name: "keyboard base", color: "black", translation: [-0.20, -0.20, 0], scale: [2.20, 0.16, 0.72] },
  ...Array.from({ length: 10 }, (_, index) => ({
    name: `keyboard key ${index + 1}`,
    color: "silver",
    translation: [-1.05 + index * 0.19, -0.08, 0.40],
    scale: [0.12, 0.05, 0.10],
  })),
  { name: "mouse body", color: "white", translation: [1.25, -0.16, 0.10], scale: [0.45, 0.18, 0.62] },
  { name: "mouse button left", color: "silver", translation: [1.14, -0.03, 0.39], scale: [0.17, 0.04, 0.23] },
  { name: "mouse button right", color: "silver", translation: [1.36, -0.03, 0.39], scale: [0.17, 0.04, 0.23] },
  { name: "scanner bed", color: "charcoal", translation: [-0.35, 0.55, -0.12], scale: [1.55, 0.18, 0.62] },
  { name: "scanner glass", color: "screen", translation: [-0.35, 0.66, -0.12], scale: [1.24, 0.05, 0.42] },
]);

createGlb("output", [
  { name: "monitor body", color: "black", translation: [-0.95, 0.42, 0], scale: [1.35, 0.82, 0.10] },
  { name: "monitor screen", color: "screen", translation: [-0.95, 0.44, 0.06], scale: [1.12, 0.58, 0.04] },
  { name: "monitor stand", color: "charcoal", translation: [-0.95, -0.12, 0], scale: [0.16, 0.35, 0.14] },
  { name: "printer body", color: "white", translation: [0.58, -0.18, 0], scale: [1.08, 0.46, 0.72] },
  { name: "printer tray", color: "silver", translation: [0.58, -0.42, 0.44], scale: [0.82, 0.08, 0.34] },
  { name: "paper", color: "white", translation: [0.58, -0.06, 0.47], scale: [0.70, 0.04, 0.38] },
  { name: "speaker left", color: "black", translation: [-1.75, 0.05, 0.05], scale: [0.28, 0.70, 0.28] },
  { name: "speaker right", color: "black", translation: [1.50, 0.05, 0.05], scale: [0.28, 0.70, 0.28] },
  { name: "speaker light left", color: "green", translation: [-1.75, 0.05, 0.22], scale: [0.14, 0.14, 0.04] },
  { name: "speaker light right", color: "green", translation: [1.50, 0.05, 0.22], scale: [0.14, 0.14, 0.04] },
]);

createGlb("storage", [
  { name: "ssd body", color: "silver", translation: [-0.65, 0.18, 0], scale: [1.30, 0.18, 0.74] },
  { name: "ssd label", color: "blue", translation: [-0.65, 0.29, 0], scale: [0.82, 0.05, 0.44] },
  { name: "ssd connector", color: "orange", translation: [0.12, 0.18, 0.43], scale: [0.38, 0.10, 0.08] },
  { name: "hard disk body", color: "charcoal", translation: [0.78, -0.20, 0], scale: [1.04, 0.28, 0.86] },
  { name: "disk plate", color: "silver", translation: [0.78, -0.02, 0], scale: [0.52, 0.05, 0.52] },
  { name: "flash drive", color: "black", translation: [-1.15, -0.48, 0.10], scale: [0.34, 0.18, 0.82] },
  { name: "flash connector", color: "silver", translation: [-1.15, -0.48, 0.62], scale: [0.24, 0.12, 0.24] },
]);

console.log("Generated PC-themed GLB models in uploads/models");
