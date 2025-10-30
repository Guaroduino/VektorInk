import { Application, Container, Graphics } from 'pixi.js';
import { GUI } from 'lil-gui';
import { ToolManager } from './core/ToolManager';

// Gestor del canvas con arquitectura de Mesh incremental
export class CanvasManager {
  private app: Application;
  private drawingContainer: Container;
  private inputLayer: Container;
  private previewLayer: Graphics;
  private toolManager: ToolManager;
  private toolSettings = {
    activeTool: 'freehand',
  };

  constructor(app: Application) {
    this.app = app;
    this.drawingContainer = new Container();
    this.inputLayer = new Container();
  (this.drawingContainer as any).label = 'drawingContainer';
  this.drawingContainer.name = 'drawingContainer';
  (this.inputLayer as any).label = 'inputLayer';
  (this.inputLayer as any).name = 'inputLayer';

    // Capa de entrada
    this.inputLayer.eventMode = 'static';
    this.inputLayer.hitArea = this.app.screen;
    this.app.stage.addChild(this.inputLayer);

    // Contenedor de trazos
    this.app.stage.addChild(this.drawingContainer);

  // Capa de previsualización por encima
  this.previewLayer = new Graphics();
  (this.previewLayer as any).label = 'previewLayer';
  this.previewLayer.name = 'previewLayer';
  this.app.stage.addChild(this.previewLayer);

    // Config de eventos globales
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.inputLayer.cursor = 'crosshair';

    // Panel lil-gui y ToolManager
    const gui = new GUI();

    // Carpeta de Herramientas en la UI
    const toolFolder = gui.addFolder('Tools');
    toolFolder
      .add(this.toolSettings, 'activeTool', ['freehand', 'line'])
      .name('Active Tool')
      .onChange((toolName: string) => {
        this.toolManager.setActiveTool(toolName);
      });

    // Clear Canvas button
    const actions = { clear: () => this.toolManager.clearScene() };
    toolFolder.add(actions, 'clear').name('Clear Canvas');

    // 1. Inicializa el ToolManager, pasándole las dependencias
    this.toolManager = new ToolManager(
      this.app,
      gui
    );

    // 2. Activa los listeners de entrada
    this.toolManager.listen();

  // 3. Establece la herramienta por defecto
  this.toolManager.setActiveTool(this.toolSettings.activeTool);

    // 4. Conecta el bucle de previsualización al ticker de la app
    this.app.ticker.add(this.onTick, this);
  }

  private onTick(): void {
    this.toolManager.renderPreview();
  }

  public get container(): Container {
    return this.drawingContainer;
  }
}
