// Genera los íconos de la app a partir del dibujo de Fia. Uso: node scripts/iconos.mjs
import sharp from "sharp";

const fia = `
  <path d="M8 66V28C8 14.7 18.7 6 32 6s24 8.7 24 22v38l-6-6-6 6-6-6-6 6-6-6-6 6-6-6z"
    fill="#ffc2d1" stroke="#14183a" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="16.5" cy="38" r="3.4" fill="#f58fa9" opacity="0.75"/>
  <circle cx="47.5" cy="38" r="3.4" fill="#f58fa9" opacity="0.75"/>
  <ellipse cx="24" cy="30" rx="2.9" ry="3.8" fill="#14183a"/>
  <ellipse cx="40" cy="30" rx="2.9" ry="3.8" fill="#14183a"/>
  <circle cx="25" cy="28.6" r="0.9" fill="#fff"/>
  <circle cx="41" cy="28.6" r="0.9" fill="#fff"/>
  <path d="M27 39q5 4.6 10 0" fill="none" stroke="#14183a" stroke-width="2.4" stroke-linecap="round"/>
  <g stroke="#2438c2" stroke-width="2" stroke-linecap="round" opacity="0.4">
    <path d="M21 50h22"/><path d="M21 55h13"/>
  </g>`;

// Fia ocupa el 56% del alto: entra en la zona segura de los íconos "maskable".
const icono = (lado) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#2438c2"/>
    <g transform="translate(32 28)">${fia}</g>
  </svg>`;

const salidas = [
  ["public/iconos/fia-192.png", 192],
  ["public/iconos/fia-512.png", 512],
  ["src/app/apple-icon.png", 180],
  ["src/app/icon.png", 96],
];

for (const [ruta, lado] of salidas) {
  await sharp(Buffer.from(icono(lado))).png().toFile(ruta);
  console.log(ruta);
}
