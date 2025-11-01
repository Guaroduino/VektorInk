import EventEmitter from 'eventemitter3';
import { Application, Container, Graphics, Point, MeshSimple, Texture } from 'pixi.js';
import { getStrokePoints } from 'perfect-freehand';
import { GUI } from 'lil-gui';
import type { ITool, VektorPointerEvent } from './ITool';
import { VektorObject } from '../core/VektorObject';
import type { StrokePoint } from '../types';
// Tess2 no longer used with mesh ribbon approach

export class FreehandTool extends EventEmitter implements ITool {
  private app: Application;

  private isDrawing: boolean = false;
  private activeStroke: MeshSimple | null = null;
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
    strokeFolder.addColor(this.strokeSettings, 'strokeColor').name('Color').onChange(() => {
      if (this.isDrawing) {
        // Simplemente redibuja el mesh; el nuevo tinte se aplicará en updateStrokeMesh
        this.updateStrokeMesh(false);
      }
    });
    strokeFolder.add(this.strokeSettings, 'size', 1, 64).name('Size').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
    strokeFolder.add(this.strokeSettings, 'thinning', -1, 1).name('Thinning').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });

    const smoothingFolder = this.gui.addFolder('Smoothing');
    smoothingFolder.add(this.strokeSettings, 'smoothing', 0, 1).name('Smoothing').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
    smoothingFolder.add(this.strokeSettings, 'streamline', 0, 1).name('Streamline').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
    smoothingFolder.add(this.strokeSettings, 'easingPreset', {
      Linear: 'linear',
      EaseIn: 'easeIn',
      EaseOut: 'easeOut',
      EaseInOut: 'easeInOut',
    }).name('Easing').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });

    const taperFolder = this.gui.addFolder('Taper');
    taperFolder.add(this.strokeSettings, 'taperStart', 0, 64).name('Taper Start').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
    taperFolder.add(this.strokeSettings, 'taperEnd', 0, 64).name('Taper End').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
    taperFolder.add(this.strokeSettings, 'capStart').name('Cap Start').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
    taperFolder.add(this.strokeSettings, 'capEnd').name('Cap End').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });

    const debugFolder = this.gui.addFolder('Debug');
    debugFolder.add(this.strokeSettings, 'simulatePressure').name('Simulate Pressure').onChange(() => {
      if (this.isDrawing) this.updateStrokeMesh(false);
    });
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

    // Use a shared 1x1 white texture with mesh tint for color
    if (!(window as any).__VEKTOR_WHITE_TEXTURE__) {
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      const ctx = c.getContext('2d');
      if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1); }
      (window as any).__VEKTOR_WHITE_TEXTURE__ = Texture.from(c);
    }

  this.activeStroke = new MeshSimple({ texture: (window as any).__VEKTOR_WHITE_TEXTURE__ });
    targetLayer.addChild(this.activeStroke);

    this.updateStrokeMesh(false);
    this.updateDebugPolyline();
  }

  public onPointerMove(event: VektorPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;

    // Añadir todos los puntos fusionados recibidos
    this.points.push(...event.points);

    this.updateStrokeMesh(false);
    this.updateDebugPolyline();
  }

  public onPointerUp(event: VektorPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;

    // Añadir los puntos finales fusionados
    this.points.push(...event.points);

  this.updateStrokeMesh(true);
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

  /**
   * Recalcula y dibuja el trazo activo usando un MeshSimple y los puntos de perfect-freehand.
   */
  private updateStrokeMesh(isComplete: boolean): void {
    if (!this.activeStroke || this.points.length === 0) return;

    // 1. Opciones para perfect-freehand (Igual que antes)
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

    // 2. Usar getStrokePoints
  const strokePoints = getStrokePoints(this.points as any, strokeOptions as any);

    if (!strokePoints || strokePoints.length < 2) {
      // Reset using SimpleMesh high-level properties
      this.activeStroke.vertices = new Float32Array();
      (this.activeStroke as any).indices = new Uint32Array();
      (this.activeStroke as any).uvs = new Float32Array();
      return;
    }

    // 3. Construir la cinta de triángulos (Mesh)
  const vertices: number[] = [];
  const indices: number[] = [];
  let index = 0;

  const totalLen = (strokePoints[strokePoints.length - 1] as any)?.runningLength ?? 0;
  // Smoothed pressure baseline similar to PF
  let H = (strokePoints[0] as any)?.pressure ?? 0.5;
  // store per-point values for caps
  const widths: number[] = [];
  const tangents: Array<[number, number]> = [];

    for (let i = 0; i < strokePoints.length; i++) {
      const current = strokePoints[i] as any; // Usamos 'any' por simplicidad
      const point = current.point as [number, number];
      const tangent = current.vector as [number, number];
      // normal from tangent
      const nx = tangent[1];
      const ny = -tangent[0];

      // Compute effective half-width m like PF (size/thinning/pressure with optional velocity influence)
      // Effective pressure p: device pressure blended with velocity-based proxy so Thinning always has visible effect
      const rawP = typeof current.pressure === 'number' ? (current.pressure as number) : 0.5;
      const sizeNorm = Math.max(1, this.strokeSettings.size || 1);
      const v = Math.min(1, (current.distance as number) / sizeNorm); // 0 slow, 1 fast
      const velP = 1 - v; // slow -> 1 (thick), fast -> 0 (thin)
      // If simulatePressure is off, still use velocity so thinning always has visible effect
      const p = this.strokeSettings.simulatePressure ? (0.5 * rawP + 0.5 * velP) : velP;
      // Compute half-width from thinning curve (matches PF form when simulatePressure drives p)
      let m: number = (this.strokeSettings.size ?? 1) * easingFn(0.5 - this.strokeSettings.thinning * (0.5 - p));
      // Apply simple start/end taper factors
      if (this.strokeSettings.taperStart) {
        const t = Math.min(1, ((current.runningLength as number) ?? 0) / this.strokeSettings.taperStart);
        m *= easingFn(t);
      }
      if (this.strokeSettings.taperEnd) {
        const remain = Math.max(0, totalLen - ((current.runningLength as number) ?? 0));
        const t = Math.min(1, remain / this.strokeSettings.taperEnd);
        m *= easingFn(t);
      }
  m = Math.max(0.01, m);
  // Hard minimum: never thinner than size/2
  m = Math.max((this.strokeSettings.size ?? 1) * 0.5, m);

  // remember tangent and width
  tangents[i] = [tangent[0], tangent[1]];
  widths[i] = m;

  // left/right vertices
      vertices.push(point[0] - nx * m, point[1] - ny * m);
      vertices.push(point[0] + nx * m, point[1] + ny * m);

      // Añadir índices
      if (i > 0) {
        indices.push(index - 2, index - 1, index);
        indices.push(index, index - 1, index + 1);
      }

      index += 2;
    }

    // 4. Añadir round caps si están activados
    const addRoundCap = (atStart: boolean) => {
      const i = atStart ? 0 : (strokePoints.length - 1);
      const point = (strokePoints[i] as any).point as [number, number];
      const t = tangents[i];
      const r = Math.max(0.01, widths[i] || (this.strokeSettings.size ?? 1) * 0.5);
      // Direction: for start cap, normal points backward; for end cap, forward
      const midAngle = Math.atan2(atStart ? -t[1] : t[1], atStart ? -t[0] : t[0]);
      const startAngle = midAngle - Math.PI * 0.5;
      const endAngle = midAngle + Math.PI * 0.5;
      const steps = 14;

      const leftIdx = i * 2;
      const rightIdx = i * 2 + 1;
      const arcIndices: number[] = [];

      // choose direction: start cap from left->right, end cap from right->left
      arcIndices.push(atStart ? leftIdx : rightIdx);

      // intermediate arc points
      for (let s = 1; s < steps; s++) {
        const a = startAngle + (s / steps) * (endAngle - startAngle);
        const ax = point[0] + Math.cos(a) * r;
        const ay = point[1] + Math.sin(a) * r;
        vertices.push(ax, ay);
        const vidx = (vertices.length / 2) - 1;
        arcIndices.push(vidx);
      }

      arcIndices.push(atStart ? rightIdx : leftIdx);

      // center vertex
      vertices.push(point[0], point[1]);
      const centerIndex = (vertices.length / 2) - 1;

      // triangles fan
      for (let k = 0; k < arcIndices.length - 1; k++) {
        indices.push(centerIndex, arcIndices[k], arcIndices[k + 1]);
      }
    };

    if (this.strokeSettings.capStart) addRoundCap(true);
    if (this.strokeSettings.capEnd) addRoundCap(false);

  // 4. Actualizar el MeshSimple
  const vertsArray = new Float32Array(vertices);
  const uvsArray = new Float32Array(vertsArray.length); // Los UVs deben coincidir
  const indicesArray = new Uint32Array(indices);
    
  // Asignar a las propiedades de alto nivel de SimpleMesh
  this.activeStroke.vertices = vertsArray;
  (this.activeStroke as any).indices = indicesArray;
  (this.activeStroke as any).uvs = uvsArray;


    // 6. Aplicar color usando 'tint'
    this.activeStroke.tint = this.strokeSettings.strokeColor;
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
