// Genera los íconos de la app: el signo de pesos de Fia. Uso: node scripts/iconos.mjs
import sharp from "sharp";

// El signo ocupa la mitad del lado: entra en la zona segura de los íconos "maskable".
const icono = (lado) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 96 96">
    <rect width="96" height="96" fill="#14804a"/>
    <g transform="translate(9.6 9.6) scale(1.6)" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round">
      <path d="M30.5 17.5c-1.2-2.6-3.6-4-6.7-4-4 0-6.8 2.2-6.8 5.4 0 7.2 14 3.6 14 10.7 0 3.3-2.9 5.5-7 5.5-3.4 0-6-1.5-7.2-4.3"/>
      <path d="M24 9.5v29"/>
    </g>
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
