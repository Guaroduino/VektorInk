Vektor es una aplicación web de dibujo híbrida (vectorial y raster) de alto rendimiento, diseñada para la entrada de stylus. Su arquitectura se basa en cuatro pipelines de renderizado distintos que se activan según la herramienta y el modo seleccionado.

Vectores Fluidos (Pluma): Captura de stylus de alta fidelidad (getCoalescedEvents()) procesada por perfect-freehand y renderizada como un polígono relleno (PIXI.Graphics.fill()) para un ancho variable.

Vectores Fluidos (Lápiz): Usa la línea central de perfect-freehand para renderizar un trazo (PIXI.Graphics.stroke()), permitiendo estilos de línea (punteado, segmentado) con ancho uniforme.

Vectores de Precisión: Herramientas (Línea, Círculo, Bézier) que generan geometría predecible y se renderizan como un trazo (PIXI.Graphics.stroke()).

Boceto Raster (Pincel): Un pipeline de "estampado de pincel" de latencia cero que dibuja directamente sobre una capa PIXI.RenderTexture (un búfer de píxeles), sin usar perfect-freehand, para una experiencia de boceto raster inmediata.

El núcleo de la gestión de escena es el VektorObject, un contenedor híbrido que gestiona sus propias representaciones vectoriales y raster. Un LayerManager global organiza estos objetos en Capas Vectoriales y Capas Raster separadas, permitiendo al usuario alternar entre un flujo de trabajo 100% vectorial y un flujo de trabajo de boceto raster ultrarrápido.

Un ToolManager modular y un SnapManager que modifica la entrada en tiempo real gestionan la lógica de dibujo. El SnapManager intercepta las coordenadas del puntero (incluyendo las de getCoalescedEvents()) y las "magnetiza" a las guías activas (rejillas, reglas, guías de perspectiva, o incluso otros trazos vectoriales) antes de pasarlas a la herramienta activa. Esto permite que tanto las herramientas vectoriales de precisión como las herramientas de boceto raster se restrinjan a las guías.

La persistencia se logra con un formato .vektor (JSON) interno y se exporta a estándares como PNG/JPG y formatos híbridos SVG/PDF que incrustan las capas raster como imágenes junto a los datos vectoriales.

1. Misión y Filosofía Central
El objetivo de Vektor es crear una herramienta de dibujo para la web que se sienta tan fluida e inmediata como una aplicación raster (ej. Procreate) pero que ofrezca el 100% de la editabilidad de una aplicación vectorial (ej. Figma).

La filosofía de diseño es "El Lienzo es el Protagonista", lo que exige una UI minimalista y un rendimiento extremo, incluso en dispositivos de gama media.

2. 🏛️ Arquitectura del Núcleo de Renderizado y Dibujo
El sistema más complejo de Vektor es el pipeline de dibujo. Está desacoplado en tres etapas (Captura, Lógica, Renderizado) y utiliza cuatro pipelines de renderizado distintos según la herramienta y el estilo activos.

Etapa 1: Captura de Alta Fidelidad (Eventos Nativos)
Para lograr una fidelidad de trazo superior, no utilizamos el sistema de eventos de PixiJS para el dibujo.

Listener Nativo: Vinculamos un listener pointermove nativo directamente al <canvas> de PixiJS.

Eventos Fusionados: Dentro del listener, usamos event.getCoalescedEvents(). Esto es crucial, ya que nos da un array de todos los puntos de datos del stylus (120Hz-240Hz) que ocurrieron entre fotogramas (60Hz), asegurando que no se pierda ninguna información de la curva.

Etapa 2 y 3: Lógica de Geometría y Renderizado (PixiJS)
Los puntos de alta fidelidad de la Etapa 1 se procesan de manera diferente según la herramienta y el estilo activos.

Pipeline 1: Vectorial Fluido (Pluma) - Relleno de Polígono
Para qué: El trazo de "tinta" principal de Vektor.

Herramienta: Mano Alzada + Estilo: Relleno Sólido / Hatch.

Pipeline: Eventos Coalesced (120Hz+) -> perfect-freehand -> Polígono -> PIXI.Graphics.fill().

Capa Destino: Capa Vectorial.

Notas: Produce trazos orgánicos de ancho variable. Los rellenos Hatch se logran usando fill({ texture: hatchTexture, ... }).

Pipeline 2: Vectorial Fluido (Lápiz) - Trazo de Línea Central
Para qué: Trazo a mano alzada con estilos de línea (punteado, etc.).

Herramienta: Mano Alzada + Estilo: Punteado / Segmentado.

Pipeline: Eventos Coalesced -> perfect-freehand (solo línea central) -> PIXI.Graphics.path() -> PIXI.Graphics.stroke().

Capa Destino: Capa Vectorial.

Notas: El ancho es uniforme. Los estilos de línea (punteado, segmentado) se renderizan pasando una textura 1D al método stroke({ texture: ... }).

Pipeline 3: Vectorial de Precisión - Trazo de Puntos de Control
Para qué: Líneas rectas, círculos, arcos, Béziers.

Herramienta: Línea, Círculo, Polilínea, Bézier.

Pipeline: Puntos de Control (ej. pointerdown, pointerup) -> PIXI.Graphics.path() -> PIXI.Graphics.stroke().

Capa Destino: Capa Vectorial.

Notas: También soporta estilos de stroke basados en textura (punteado, segmentado).

Pipeline 4: Boceto Raster - Estampado de Pincel
Para qué: Bocetaje rápido, sombreado, notas. La experiencia de "Photoshop" de latencia cero.

Herramienta: Pincel Raster (o Mano Alzada en "Modo Raster").

Pipeline:

El usuario dibuja en una Capa Raster. Esta capa es un PIXI.RenderTexture (un búfer de píxeles del tamaño del lienzo).

Capturamos Eventos Coalesced (120Hz+) para obtener la máxima suavidad de la ruta.

Para cada punto (e interpolando entre ellos), "estampamos" una textura de pincel (PIXI.Sprite) directamente sobre el PIXI.RenderTexture usando renderer.render(brushSprite, { renderTexture: ..., clear: false }).

No se usa perfect-freehand.

Capa Destino: Capa Raster.

Notas: Es el método de dibujo más rápido posible ("blitting" de texturas). Es un dibujo destructivo dentro de su capa.

3. El Objeto de Vektor: Un Contenedor Híbrido
El modelo de datos central de Vektor es el VektorObject (o VektorStroke). Este objeto es un PIXI.Container especial que gestiona sus diferentes representaciones y datos crudos:

vectorRepresentation: Un objeto PIXI.Graphics (usado en Capas Vectoriales).

rasterRepresentation: Un objeto PIXI.Sprite (usado en Capas Raster, su textura es el RenderTexture de la capa).

highFidelityPoints: Los puntos crudos de getCoalescedEvents() (usados para regenerar el trazo).

controlPoints: Una versión simplificada (Bézier) de la línea central (usada para la edición de nodos).

4. Gestión de Capas Híbridas
Nuestra UI de capas no es una simple lista. Refleja la dualidad de la aplicación:

Capas Raster: Son, en esencia, PIXI.RenderTexture. El Pipeline 4 dibuja directamente en la textura de la capa activa. Permiten un flujo de trabajo de boceto rápido y destructivo.

Capas Vectoriales: Son PIXI.Container estándar que contienen las vectorRepresentation de los VektorObjects. El dibujo aquí es no destructivo y basado en objetos.

El usuario puede tener una "Capa de Boceto" (Raster) debajo de una "Capa de Entintado" (Vectorial), permitiendo un flujo de trabajo profesional.

5. Sistema de Herramientas, Estado y Asistentes
La lógica de la aplicación está gestionada por un sistema de estado centralizado y modificadores de entrada.

DrawingContext (Estado Global): Un objeto de estado simple que la UI modifica. Define la intención del usuario. (ej. { toolType: 'line', strokeAppearance: 'dotted', color: 0xFF0000, ... }).

ToolManager (Máquina de Estados): Mantiene la herramientaActiva (ej. LineTool, FreehandTool, RasterBrushTool). El ToolManager lee el DrawingContext y los eventos de entrada, y decide qué pipeline activar.

GuideManager (Capa Visual): Dibuja las guías (rejillas, reglas, guías de perspectiva) en una capa PIXI.Container separada (guideLayer). Solo se actualiza en zoom/pan.

SnapManager (Modificador de Entrada): Este es un sistema crítico. Se sitúa entre la captura de eventos y el ToolManager.

Flujo de Snap (El Núcleo de la Asistencia):

pointermove nativo se dispara (con getCoalescedEvents()).

El SnapManager toma cada uno de los puntos de alta frecuencia.

Comprueba si el "snap" está activo (a la rejilla, a las guías de perspectiva, o a los trazos vectoriales de otra capa).

Si se encuentra un punto de ajuste cercano, modifica la coordenada de ese punto.

Pasa el array de puntos ya modificados al ToolManager.

El ToolManager pasa estos puntos alineados a la herramienta activa (ya sea el Pipeline 1, 2, 3 o 4).

Esta arquitectura permite que incluso el boceto raster (Pipeline 4) se restrinja a guías, permitiendo al usuario dibujar una línea recta con textura de pincel simplemente siguiendo una regla.

6. Gestión de Escena y Componentes
Grupos: Contenedores simples (PIXI.Container) para agrupar VektorObjects dentro de una misma capa.

Componentes (Maestros e Instancias): La característica de reusabilidad más potente. Un Componente Maestro es un VektorObject (o grupo) guardado en una librería. Una Instancia es un clon que referencia al Maestro. Editar el Maestro actualiza el contenido de todas las Instancias en tiempo real.

7. Estrategia de Persistencia y Exportación
Vektor distingue claramente entre guardar el trabajo (fidelidad total) y exportar (interoperabilidad).

Guardado (.vektor):

Un archivo .json que es un volcado directo del estado de la aplicación.

Guarda todo: datos de trazo (vectoriales), la estructura de capas (incluyendo referencias a los RenderTexture de las Capas Raster, que se guardarían como PNGs dentro del JSON o en una carpeta) y las configuraciones de guías y componentes.

Exportación Raster (PNG / JPG):

Implementación: Fácil. Usamos la API de PixiJS renderer.extract.image(app.stage).

Exportación Híbrida (SVG / PDF):

Desafío: ¿Qué hacemos con las Capas Raster (Pipeline 4)?

Solución: Las capas raster se exportan como imágenes PNG incrustadas (<image>) dentro del archivo SVG/PDF, preservando su posición.

Las capas vectoriales se exportan como caminos (<path>, <circle>, etc.), ofreciendo al usuario la opción de "Preservar Apariencia" (exportar el polígono relleno de perfect-freehand) u "Optimizar para Edición" (exportar la línea central simplificada).