import type { Worker } from "tesseract.js";

// El lector de texto se carga recién con la primera captura y queda listo para las siguientes.
let lector: Promise<Worker> | null = null;

const LADO_MAXIMO = 3000;
const UMBRAL_OSCURO = 110;

/**
 * Deja la imagen en grises y, si es una captura en modo oscuro, la invierte:
 * el reconocimiento lee mejor texto oscuro sobre fondo claro.
 */
async function preparar(archivo: Blob): Promise<HTMLCanvasElement> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);

  const contexto = lienzo.getContext("2d", { willReadFrequently: true })!;
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  const datos = contexto.getImageData(0, 0, lienzo.width, lienzo.height);
  const px = datos.data;
  let suma = 0;
  for (let i = 0; i < px.length; i += 4) {
    const gris = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = gris;
    suma += gris;
  }
  if (suma / (px.length / 4) < UMBRAL_OSCURO) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  contexto.putImageData(datos, 0, 0);
  return lienzo;
}

/**
 * Lee el texto de una imagen dentro del navegador. La imagen no sale del
 * dispositivo: no se sube a ningún servidor ni pasa por un modelo generativo.
 */
export async function leerImagen(archivo: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  lector ??= createWorker("spa");
  try {
    const { data } = await (await lector).recognize(await preparar(archivo));
    return data.text;
  } catch (error) {
    lector = null;
    throw error;
  }
}
