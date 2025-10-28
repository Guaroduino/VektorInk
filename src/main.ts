// Archivo principal de la aplicación Vektor
// Sigue las directrices en AI_CODING_GUIDELINES.md

import './style.css';
import { Application, Rectangle } from 'pixi.js';
import { CanvasManager } from './CanvasManager';

// Opciones por defecto para la inicialización
const INIT_OPTIONS = {
  resizeTo: window as unknown as HTMLElement, // Pixi acepta `window` para resizeTo
  backgroundColor: 0x1a1a1a,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
} as const;

// Creamos la instancia inicialmente sin opciones para poder invocar app.init() si existe.
let app = new Application();

(async () => {
  try {
    // Llamamos a init de forma asíncrona sin fallback. Se asume que el runtime (PIXI v8)
    // proporciona este método o un polyfill adecuado en el entorno de ejecución.
    await (app as any).init(INIT_OPTIONS);

    // El elemento canvas real de PIXI se expone como `canvas` en v8.
    // Usamos únicamente `app.canvas` (getter) para evitar la advertencia de deprecación.
    const canvas = (app as any).canvas as HTMLCanvasElement;

    // Añadimos el canvas al contenedor #app para evitar que un overlay DOM lo cubra
    if (canvas) {
      const mount = document.getElementById('app') || document.body;
      mount.appendChild(canvas);
    } else {
      console.warn('Vektor: app.canvas no está disponible en este entorno; asegúrate de usar Pixi v8+.');
    }

    // Aseguramos que el stage capture eventos de puntero en todo el lienzo
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen as Rectangle;

  console.log('Vektor: aplicación inicializada correctamente', { app });

  // Inicializamos el gestor del canvas y el contenedor de dibujo
  const canvasManager = new CanvasManager(app);
  // (opcional) exportarlo o exponerlo globalmente si se necesita en otros módulos
  (app as any).canvasManager = canvasManager;
  } catch (err) {
    console.error('Vektor: error inicializando la aplicación', err);
  }
})();

// Exportamos la instancia por si otros módulos la necesitan.
export { app };
