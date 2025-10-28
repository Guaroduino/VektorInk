# Directrices de Desarrollo para Vektor (Contexto para IA)

## 1. Filosofía UI/UX 🎨
* **Minimalista y Moderna:** La interfaz debe ser extremadamente limpia, con controles que aparezcan solo cuando sean necesarios. El lienzo es el protagonista.
* **Estilo Visual:** Inspirado en la utilidad y limpieza de TailwindCSS. Evitar estilos sobrecargados, `glassmorphism`, sombras complejas o efectos que consuman muchos recursos.
* **Responsividad:** La interfaz debe adaptarse fluidamente a diferentes tamaños de pantalla, priorizando la usabilidad en tablets.
* **Iconografía:** Usar iconos SVG claros y universales en lugar de texto siempre que sea posible para minimizar el desorden visual.

## 2. Prioridades de Interacción 👆🖱️🖊️
* **Stylus y Táctil Primero:** Diseñar todas las interacciones pensando principalmente en la entrada con stylus (sensibilidad a la presión si es posible) y gestos táctiles (pellizcar para zoom, arrastrar con dos dedos para pan, etc.).
* **Evitar Input de Teclado:** No depender de atajos de teclado o campos de texto para las funciones *principales* de dibujo y manipulación. El teclado es secundario (ej. para nombrar capas, si acaso).
* **Rendimiento de Interacción:** Las interacciones deben sentirse inmediatas y fluidas, sin retrasos perceptibles.

## 3. Arquitectura y Código 🏗️
* **Modularidad:** Mantener una clara separación entre el núcleo lógico/gráfico y la interfaz de usuario.
* **Rendimiento Gráfico:** Seguir las mejores prácticas de Pixi.js (uso de `Graphics.fill`, optimización de buffers, etc.). Ver `docs/pixijs/README.md`.
* **Tipado:** Usar TypeScript de forma estricta.

## 4. Inspiración ✨
* **Funcionalidad y Fluidez:** App "Concepts" (Android/iOS).
* **Estilo UI:** Limpieza y utilidad similar a TailwindCSS.

**Meta Principal:** Crear una experiencia de dibujo vectorial fluida, intuitiva y de alto rendimiento centrada en el lienzo.
