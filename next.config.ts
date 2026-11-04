import type { NextConfig } from "next";

/**
 * Next.js, en modo desarrollo (`npm run dev`), solo entrega su JavaScript a quien abre la app
 * desde localhost. Si se entra por la IP de la laptop (http://192.168.x.x:3000) la página se ve
 * pero los botones no responden. Aquí se autorizan las direcciones de red local privadas.
 * En producción (`npm run build` + `npm start`) esta restricción no existe.
 */
const redLocal = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  "*.local",
];

const nextConfig: NextConfig = {
  // Oculta el indicador de desarrollo de Next.js: no debe verse en la pantalla proyectada.
  devIndicators: false,
  allowedDevOrigins: redLocal,

  /*
   * Al desplegar, Next empaqueta con cada ruta solo los archivos que detecta leyendo
   * el código. La ruta /api/preguntas compone el camino en tiempo de ejecución
   * (process.cwd() + "preguntas.json"), así que hay que incluirlo a mano: sin esto,
   * la página desplegada arranca pero no encuentra las preguntas.
   */
  outputFileTracingIncludes: {
    "/api/preguntas": ["./preguntas.json"],
  },
};

export default nextConfig;
