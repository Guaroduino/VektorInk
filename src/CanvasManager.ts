import { 
  Application, 
  Container, 
  FederatedPointerEvent, 
  Graphics, 
  Point 
} from 'pixi.js';
import { getStroke } from 'perfect-freehand';
import { GUI } from 'lil-gui';

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timeStamp: number;
}

// Gestor del canvas con arquitectura de Mesh incremental
export class CanvasManager {
  private app: Application;
  private drawingContainer: Container;
  private inputLayer: Container;
  private isDrawing: boolean = false;
  
  // --- NUEVA ARQUITECTURA DE TRAZO ---
  private activeStroke: Graphics | null = null; // Un único Graphics para el trazo activo
  private activePointerId: number | null = null;
  private strokes: Graphics[] = []; // Almacena los trazos completados
  
  private debugPolylineLayer: Graphics;
  
  // --- LISTA DE PUNTOS SIMPLIFICADA ---
  private points: StrokePoint[] = [];

  // Panel GUI y opciones de trazo
  private gui: GUI;
  private strokeSettings = {
    size: 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    taperStart: 0,
    taperEnd: 0,
    simulatePressure: true,
    strokeColor: 0xff0000,
    showPolyline: false,
    // Advanced
    capStart: true,
    capEnd: true,
    easingPreset: 'linear' as 'linear' | 'easeIn' | 'easeOut' | 'easeInOut',
    clearCanvas: () => { this.clearCanvas(); },
  };

  constructor(app: Application) {
    this.app = app;
    this.drawingContainer = new Container();
    this.inputLayer = new Container();
    (this.drawingContainer as any).label = 'drawingContainer';
    (this.inputLayer as any).label = 'inputLayer';

    // Capa de entrada
    this.inputLayer.eventMode = 'static';
    this.inputLayer.hitArea = this.app.screen;
    this.app.stage.addChild(this.inputLayer);

    // Contenedor de trazos
    this.app.stage.addChild(this.drawingContainer);

    // Capa de depuración por encima
    this.debugPolylineLayer = new Graphics();
    (this.debugPolylineLayer as any).label = 'debugPolylineLayer';
    this.debugPolylineLayer.visible = this.strokeSettings.showPolyline;
    this.app.stage.addChild(this.debugPolylineLayer);

    // Config de eventos globales
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.inputLayer.cursor = 'crosshair';

    // Suscripción de eventos
    this.inputLayer.on('pointerdown', this.onPointerDown.bind(this));
    this.inputLayer.on('pointermove', this.onPointerMove.bind(this));
    this.inputLayer.on('pointerup', this.onPointerUp.bind(this));
    this.inputLayer.on('pointerupoutside', this.onPointerUp.bind(this));

    // Panel lil-gui
    this.gui = new GUI();
    const strokeFolder = this.gui.addFolder('Stroke Settings');
    strokeFolder.addColor(this.strokeSettings, 'strokeColor').name('Color');
    strokeFolder.add(this.strokeSettings, 'size', 1, 64).name('Size');
    strokeFolder.add(this.strokeSettings, 'thinning', -1, 1).name('Thinning');

    const smoothingFolder = this.gui.addFolder('Smoothing');
    smoothingFolder.add(this.strokeSettings, 'smoothing', 0, 1).name('Smoothing');
    smoothingFolder.add(this.strokeSettings, 'streamline', 0, 1).name('Streamline');
    smoothingFolder.add(this.strokeSettings, 'easingPreset', {
      Linear: 'linear',
      EaseIn: 'easeIn',
      EaseOut: 'easeOut',
      EaseInOut: 'easeInOut',
    }).name('Easing');

    const taperFolder = this.gui.addFolder('Taper');
    taperFolder.add(this.strokeSettings, 'taperStart', 0, 64).name('Taper Start');
    taperFolder.add(this.strokeSettings, 'taperEnd', 0, 64).name('Taper End');
    taperFolder.add(this.strokeSettings, 'capStart').name('Cap Start');
    taperFolder.add(this.strokeSettings, 'capEnd').name('Cap End');

    const debugFolder = this.gui.addFolder('Debug');
    debugFolder.add(this.strokeSettings, 'simulatePressure').name('Simulate Pressure');
    debugFolder
      .add(this.strokeSettings, 'showPolyline')
      .name('Show Polyline')
      .onChange((value: boolean) => {
        this.debugPolylineLayer.visible = value;
        if (value && this.points.length > 0) {
          this.updateDebugPolyline();
        } else {
          this.debugPolylineLayer.clear();
        }
      });

    this.gui.add(this.strokeSettings, 'clearCanvas').name('Clear Canvas');
  }

  public clearCanvas(): void {
    // Destruir todos los trazos completados
    for (const stroke of this.strokes) {
      stroke.destroy();
    }
    this.strokes = [];

    // Destruir trazo activo si existe
    if (this.activeStroke) {
      this.activeStroke.destroy();
      this.activeStroke = null;
    }

    // Limpiar la capa de depuración
    this.debugPolylineLayer.clear();

    // Resetear estado
    this.isDrawing = false;
    this.activePointerId = null;
    // Limpiar lista de puntos
    this.points = [];
  }

  private onPointerDown(event: FederatedPointerEvent): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    this.activePointerId = event.pointerId;
    // Reset listas
    this.points = [];
    this.debugPolylineLayer.clear();

    const initialStrokePoint = this.mapEventToStrokePoint(event);
    this.points.push(initialStrokePoint);

    // Crear el Graphics que representará el trazo actual
    this.activeStroke = new Graphics();
    this.drawingContainer.addChild(this.activeStroke);

    // Pintar primer punto
    this.updateStrokeGraphics(false);
    this.updateDebugPolyline();
  }

  private onPointerMove(event: FederatedPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;

    const pointsToAdd = this.getCoalescedStrokePoints(event);
    this.points.push(...pointsToAdd);

    // Actualizar el dibujo del trazo
    this.updateStrokeGraphics(false);
    this.updateDebugPolyline();
  }

  private onPointerUp(event: FederatedPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;

    // Añadir los puntos finales (si los hay)
    const finalPoints = this.getCoalescedStrokePoints(event);
    this.points.push(...finalPoints);

    // Dibujo final y completo del trazo
    this.updateStrokeGraphics(true);
    this.updateDebugPolyline();

    this.isDrawing = false;

    // Guardar el trazo
    if (this.activeStroke) {
      this.strokes.push(this.activeStroke);
    }
    
    this.activeStroke = null;
    this.activePointerId = null;

    console.log('Stop Drawing');
  }

  /**
   * Recalcula y dibuja el trazo activo usando Graphics y el polígono de perfect-freehand.
   */
  private updateStrokeGraphics(isComplete: boolean): void {
    if (!this.activeStroke || this.points.length < 2) return;

    // 1. Opciones para perfect-freehand
    const easingFn = (() => {
      switch (this.strokeSettings.easingPreset) {
        case 'easeIn': return (t: number) => t * t;
        case 'easeOut': return (t: number) => 1 - (1 - t) * (1 - t);
        case 'easeInOut': return (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        case 'linear': default: return (t: number) => t;
      }
    })();

    const strokeOptions = {
      size: this.strokeSettings.size,
      thinning: this.strokeSettings.thinning,
      smoothing: this.strokeSettings.smoothing,
      streamline: this.strokeSettings.streamline,
      simulatePressure: this.strokeSettings.simulatePressure,
      easing: easingFn,
      start: {
        cap: this.strokeSettings.capStart,
        taper: this.strokeSettings.taperStart,
        easing: easingFn,
      },
      end: {
        cap: this.strokeSettings.capEnd,
        taper: this.strokeSettings.taperEnd,
        easing: easingFn,
      },
      last: isComplete,
    } as const;

    // 2. Calcular el contorno del trazo
    const outline = getStroke(this.points as any, strokeOptions as any);
    if (outline.length < 3) {
      this.activeStroke.clear();
      return;
    }

    // 3. Dibujar el polígono relleno
    this.activeStroke.clear();
    this.activeStroke.setFillStyle(this.strokeSettings.strokeColor);
    const [firstX, firstY] = outline[0];
    this.activeStroke.moveTo(firstX, firstY);
    for (let i = 1; i < outline.length; i++) {
      const [x, y] = outline[i];
      this.activeStroke.lineTo(x, y);
    }
    this.activeStroke.closePath();
    this.activeStroke.fill();
  }


  // Dibuja la polilínea de puntos crudos en la capa de depuración
  private updateDebugPolyline(): void {
    this.debugPolylineLayer.clear();
    
    if (!this.strokeSettings.showPolyline || this.points.length < 2) {
      return;
    }

    this.debugPolylineLayer.setStrokeStyle({ width: 1, color: 0x0000ff, alpha: 0.5 });

    const firstPoint = this.points[0];
    this.debugPolylineLayer.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < this.points.length; i++) {
      const point = this.points[i];
      this.debugPolylineLayer.lineTo(point.x, point.y);
    }
    this.debugPolylineLayer.stroke();
  }

  // --- Métodos auxiliares ---
  private getCoalescedStrokePoints(event: FederatedPointerEvent): StrokePoint[] {
    const nativeEvent = event.nativeEvent as PointerEvent;
    const strokePoints: StrokePoint[] = [];

    // Ahora solo necesitamos el último punto de la lista 'points'
    const lastAdded = this.points[this.points.length - 1];

    if (nativeEvent && typeof nativeEvent.getCoalescedEvents === 'function') {
      const coalescedEvents = nativeEvent.getCoalescedEvents();

      for (const ce of coalescedEvents) {
        const currentPoint = this.mapEventToStrokePoint(ce);
        if (
          !(
            lastAdded &&
            currentPoint.x === lastAdded.x &&
            currentPoint.y === lastAdded.y &&
            currentPoint.timeStamp === lastAdded.timeStamp
          )
        ) {
          strokePoints.push(currentPoint);
        }
      }
    } 
    
    // Asegurarse de que el evento principal también se incluya si es único
    const mainPoint = this.mapEventToStrokePoint(event);
    const isMainEventCoalesced = strokePoints.some((p) => p.timeStamp === mainPoint.timeStamp);
    
    if (
      !isMainEventCoalesced &&
      !(
        lastAdded &&
        mainPoint.x === lastAdded.x &&
        mainPoint.y === lastAdded.y &&
        mainPoint.timeStamp === lastAdded.timeStamp
      )
    ) {
      strokePoints.push(mainPoint);
    }
    
    // Ordenar por si acaso
    if (strokePoints.length > 1) {
      strokePoints.sort((a, b) => a.timeStamp - b.timeStamp);
    }

    return strokePoints;
  }

  private mapEventToStrokePoint(ev: FederatedPointerEvent | PointerEvent): StrokePoint {
    const point = this.mapEventToPoint(ev);
    const pressure = (ev as PointerEvent).pressure === 0 ? 0.5 : (ev as PointerEvent).pressure || 0.5;
    const timeStamp = (ev as any).timeStamp as number;
    return { x: point.x, y: point.y, pressure, timeStamp };
  }

  private mapEventToPoint(ev: FederatedPointerEvent | PointerEvent): Point {
    const tempPoint = new Point();
    const clientX = (ev as PointerEvent).clientX ?? (ev as FederatedPointerEvent).client?.x;
    const clientY = (ev as PointerEvent).clientY ?? (ev as FederatedPointerEvent).client?.y;

    if (clientX === undefined || clientY === undefined) {
      console.error('ClientX/Y son undefined, no se puede mapear el punto.', ev);
      if ('global' in (ev as any) && (ev as any).global) {
        return (ev as FederatedPointerEvent).global.clone();
      }
      return new Point(0, 0);
    }

    if ((this.app.renderer as any)?.events) {
      (this.app.renderer as any).events.mapPositionToPoint(tempPoint, clientX, clientY);
      return tempPoint;
    }
    console.warn('Renderer o sistema de eventos no disponible para mapear puntos.');
    if ('global' in (ev as any) && (ev as any).global) {
      return (ev as FederatedPointerEvent).global.clone();
    }
    return new Point(clientX, clientY);
  }

  public get container(): Container {
    return this.drawingContainer;
  }
}