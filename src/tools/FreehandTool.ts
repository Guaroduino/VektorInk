import EventEmitter from 'eventemitter3';
import { Application, Container, Graphics, Point } from 'pixi.js';
import { getStroke } from 'perfect-freehand';
import { GUI } from 'lil-gui';
import type { ITool, VektorPointerEvent } from './ITool';
import { VektorObject } from '../core/VektorObject';
import type { StrokePoint } from '../types';

export class FreehandTool extends EventEmitter implements ITool {
  private app: Application;

  private isDrawing: boolean = false;
  private activeStroke: Graphics | null = null;
  private activePointerId: number | null = null;
  private strokes: Graphics[] = [];
  private debugPolylineLayer: Graphics;
  private points: StrokePoint[] = [];
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
  };

  constructor(app: Application, gui: GUI) {
    super();
    this.app = app;
    this.gui = gui;

    this.debugPolylineLayer = new Graphics();
    (this.debugPolylineLayer as any).label = 'debugPolylineLayer';
    this.debugPolylineLayer.visible = this.strokeSettings.showPolyline;

    // GUI wiring (copied from CanvasManager)
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
  }

  // ITool implementation
  public onPointerDown(event: VektorPointerEvent, targetLayer: Container): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    this.activePointerId = event.pointerId;
    this.points = [];
    this.debugPolylineLayer.clear();

    // Añadir todos los puntos iniciales (normalmente uno)
    this.points.push(...event.points);

    this.activeStroke = new Graphics();
    targetLayer.addChild(this.activeStroke);

    this.updateStrokeGraphics(false);
    this.updateDebugPolyline();
  }

  public onPointerMove(event: VektorPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;

    // Añadir todos los puntos fusionados recibidos
    this.points.push(...event.points);

    this.updateStrokeGraphics(false);
    this.updateDebugPolyline();
  }

  public onPointerUp(event: VektorPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;

    // Añadir los puntos finales fusionados
    this.points.push(...event.points);

    this.updateStrokeGraphics(true);
    this.updateDebugPolyline();

    if (this.activeStroke && this.points.length > 0) {
      const finalObject = new VektorObject({
        points: this.points,
        geometry: this.activeStroke,
      });

      this.emit('strokeComplete', finalObject);
    }

    this.activeStroke = null;
    this.points = [];
    this.isDrawing = false;
    this.activePointerId = null;

    console.log('Stop Drawing (FreehandTool)');
  }

  public onDeactivate(): void {
    if (this.isDrawing && this.activePointerId !== null) {
      const last = this.points[this.points.length - 1];
      const synthetic: VektorPointerEvent = {
        global: last ? new Point(last.x, last.y) : new Point(0, 0),
        points: [],
        pressure: last?.pressure ?? 0.5,
        pointerId: this.activePointerId,
        nativeEvent: new PointerEvent('pointerup'),
      };
      this.onPointerUp(synthetic);
    }
    this.debugPolylineLayer.clear();
  }

  public onRenderPreview(previewGraphics: Graphics): void {
    if (this.debugPolylineLayer.visible) {
      previewGraphics.addChild(this.debugPolylineLayer);
    }
  }

  // Migrated helpers
  private updateStrokeGraphics(isComplete: boolean): void {
    if (!this.activeStroke || this.points.length < 2) return;

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

    const outline = getStroke(this.points as any, strokeOptions as any);
    if (outline.length < 3) {
      this.activeStroke.clear();
      return;
    }

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

  // El ToolManager ya proporciona puntos con timestamp/pressure; no se necesitan helpers extra
}
