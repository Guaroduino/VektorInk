import { Container, Application, FederatedPointerEvent, Graphics } from 'pixi.js';

// Gestor simple del canvas/drawing layer
export class CanvasManager {
  private app: Application;
  private drawingContainer: Container;
  private inputLayer: Container;
  private isDrawing: boolean = false;
  private lastPoint: { x: number; y: number } | null = null;
  private currentStroke: Graphics | null = null;

  constructor(app: Application) {
    this.app = app;
  this.drawingContainer = new Container();
  this.inputLayer = new Container();
  // use `label` instead of deprecated `name`
  // https://pixijs.download/dev/docs/PIXI.Container.html#label
  (this.drawingContainer as any).label = 'drawingContainer';

  // Añadimos un inputLayer que captura eventos y el contenedor de dibujo como capa visual
  ;(this.inputLayer as any).label = 'inputLayer';
  this.inputLayer.eventMode = 'static';
  this.inputLayer.hitArea = this.app.screen;
  this.app.stage.addChild(this.inputLayer);
  // Añadimos el contenedor principal al stage para contener todos los trazos.
  this.app.stage.addChild(this.drawingContainer);
  // Configuración correcta de eventos para el stage en PixiJS v8+
  // Habilita eventos y define el área de captura (toda la pantalla)
  this.app.stage.eventMode = 'static';
  this.app.stage.hitArea = this.app.screen;
  // Change cursor to verify event system is active over the hitArea
  this.inputLayer.cursor = 'crosshair';
  // Register pointer events for basic drawing input on the input layer
  this.inputLayer.on('pointerdown', this.onPointerDown.bind(this));
  this.inputLayer.on('pointermove', this.onPointerMove.bind(this));
  this.inputLayer.on('pointerup', this.onPointerUp.bind(this));
  // Global events to ensure we capture outside of the hit object as well
  this.inputLayer.on('globalpointermove', this.onPointerMove.bind(this));
  this.inputLayer.on('globalpointerup', this.onPointerUp.bind(this));
  // Manejar cuando se suelta el puntero fuera del canvas
  this.inputLayer.on('pointerupoutside', this.onPointerUp.bind(this));

    // Debug info about stage event configuration
    // eslint-disable-next-line no-console
    console.log('Stage event config', {
      stage: {
        eventMode: (this.app.stage as any).eventMode,
        hasHitArea: !!(this.app.stage as any).hitArea,
      },
      inputLayer: {
        eventMode: (this.inputLayer as any).eventMode,
        hasHitArea: !!(this.inputLayer as any).hitArea,
      },
      screen: { w: this.app.screen.width, h: this.app.screen.height },
    });
  }

  // Elimina todos los hijos del contenedor de dibujo
  public clearCanvas(): void {
    this.drawingContainer.removeChildren();
    // Reset drawing state
    this.isDrawing = false;
    this.lastPoint = null;
  }

  private onPointerDown(event: FederatedPointerEvent): void {
    this.isDrawing = true;
    const { x, y } = event.global;
    this.lastPoint = { x, y };
    // Create a single Graphics for this stroke
    const g = new Graphics();
    g.setStrokeStyle({ width: 2, color: 0xff0000, alpha: 1, cap: 'round', join: 'round' });
    g.moveTo(x, y);
    this.drawingContainer.addChild(g);
    this.currentStroke = g;
    // Debug: confirm pointer down
    console.log('Start Drawing', { x, y });
  }

  private onPointerMove(event: FederatedPointerEvent): void {
    if (!this.isDrawing) return;
    const { x, y } = event.global;
    if (this.lastPoint && this.currentStroke) {
      this.currentStroke.lineTo(x, y);
      this.currentStroke.stroke();
    }
    this.lastPoint = { x, y };
  }

  private onPointerUp(_: FederatedPointerEvent): void {
    this.isDrawing = false;
    this.lastPoint = null;
    this.currentStroke = null;
    // Optional debug
    console.log('Stop Drawing');
  }

  // Opcional: getter para acceder al contenedor en caso de ser necesario
  public get container(): Container {
    return this.drawingContainer;
  }
}
