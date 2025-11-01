import { ITool, VektorPointerEvent } from './ITool';
import { MeshManager } from '../core/MeshManager';
import { GUI } from 'lil-gui';
import { Container, Graphics, Color } from 'pixi.js';
import { getStrokePoints } from 'perfect-freehand';
import type { StrokePoint } from '../types';

/**
 * Stub minimal de LegacyInkTool.
 * Implementación pequeña para integrarse con ToolManager. Puede ser ampliada más adelante.
 */
export class LegacyInkTool implements ITool {
  private meshManager: MeshManager;
  private gui: GUI;
  private isDrawing: boolean = false;
  private activePointerId: number | null = null;
  private points: StrokePoint[] = [];
  private lastStrokePoint: any = null;
  private debug = {
    enabled: false,
    showVertices: true,
    showTriangles: true,
    showNormals: false,
  };
  private debugSegments: Array<{
    AL: [number, number]; AR: [number, number]; BL: [number, number]; BR: [number, number];
    centerPrev: [number, number]; centerCurr: [number, number];
    normalPrev: [number, number]; normalCurr: [number, number];
  }> = [];
  private strokeSettings = {
    size: 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    strokeColor: 0xff0000,
    alpha: 0.2,
    capStart: true,
    capEnd: true,
    taperStart: 0,
    taperEnd: 0,
    easingPreset: 'linear' as 'linear' | 'easeIn' | 'easeOut' | 'easeInOut',
  };

  constructor(meshManager: MeshManager, gui: GUI) {
    this.meshManager = meshManager;
    this.gui = gui;
    // Controles básicos para el trazo de tinta legacy
    const legacyFolder = this.gui.addFolder('Legacy Ink');
    legacyFolder.addColor(this.strokeSettings, 'strokeColor').name('Color');
    legacyFolder.add(this.strokeSettings, 'size', 1, 64).name('Size');
    legacyFolder.add(this.strokeSettings, 'alpha', 0.01, 1.0, 0.01).name('Alpha');
    legacyFolder.add(this.strokeSettings, 'simulatePressure').name('Simulate Pressure');
    legacyFolder.add(this.strokeSettings, 'smoothing', 0, 1).name('Smoothing');
    legacyFolder.add(this.strokeSettings, 'streamline', 0, 1).name('Streamline');
    legacyFolder.add(this.strokeSettings, 'thinning', -1, 1).name('Thinning');
    legacyFolder.add(this.strokeSettings, 'capStart').name('Cap Start');
    legacyFolder.add(this.strokeSettings, 'capEnd').name('Cap End');
    legacyFolder.add(this.strokeSettings, 'taperStart', 0, 64).name('Taper Start');
    legacyFolder.add(this.strokeSettings, 'taperEnd', 0, 64).name('Taper End');

    const debugFolder = legacyFolder.addFolder('Debug');
    debugFolder.add(this.debug, 'enabled').name('Enable Debug');
    debugFolder.add(this.debug, 'showVertices').name('Show Vertices');
    debugFolder.add(this.debug, 'showTriangles').name('Show Triangles');
    debugFolder.add(this.debug, 'showNormals').name('Show Normals');
  }

  public onPointerDown(event: VektorPointerEvent, targetLayer: Container): void {
    this.isDrawing = true;
    this.activePointerId = event.pointerId;
    this.points = []; // Reset
    this.lastStrokePoint = null;
    
    this.points.push(...event.points);
    this.runStrokeGeneration(false); // Dibuja el primer punto/segmento
    if (this.debug.enabled) this.debugSegments.length = 0;
  }

  public onPointerMove(event: VektorPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;
    
    this.points.push(...event.points);
    this.runStrokeGeneration(false);
  }

  public onPointerUp(event: VektorPointerEvent): void {
    if (!this.isDrawing || event.pointerId !== this.activePointerId) return;
    
    this.points.push(...event.points);
    this.runStrokeGeneration(true); // Dibuja el segmento final
    
    this.isDrawing = false;
    this.activePointerId = null;
    this.points = [];
    this.lastStrokePoint = null;
  // Keep debug segments on screen until next stroke starts
    
    // No emitimos VektorObject. El dibujo está "quemado" en la malla.
    console.log('Stop Drawing (LegacyInkTool)');
  }

  public onDeactivate(): void {
    // No-op
  }

  public onRenderPreview(previewGraphics: Graphics): void {
    if (!this.debug.enabled || this.debugSegments.length === 0) return;
    // Draw debug overlay: triangles, vertices, normals
    const g = previewGraphics;
    const vertColor = 0x00ff00;
    const triColor = 0x0000ff;
    const normalColor = 0xffaa00;

    for (const seg of this.debugSegments) {
      const { AL, AR, BL, BR, centerPrev, centerCurr, normalPrev, normalCurr } = seg;

      if (this.debug.showTriangles) {
        // Draw outlines of trapezoid (two triangles share diagonal)
        g.setStrokeStyle({ width: 1, color: triColor, alpha: 0.75 });
        g.moveTo(AL[0], AL[1]); g.lineTo(AR[0], AR[1]);
        g.lineTo(BR[0], BR[1]); g.lineTo(BL[0], BL[1]); g.lineTo(AL[0], AL[1]);
        g.stroke();
      }

      if (this.debug.showVertices) {
        const r = 2.5;
        g.circle(AL[0], AL[1], r).fill({ color: vertColor, alpha: 0.9 });
        g.circle(AR[0], AR[1], r).fill({ color: vertColor, alpha: 0.9 });
        g.circle(BL[0], BL[1], r).fill({ color: vertColor, alpha: 0.9 });
        g.circle(BR[0], BR[1], r).fill({ color: vertColor, alpha: 0.9 });
      }

      if (this.debug.showNormals) {
        g.setStrokeStyle({ width: 1, color: normalColor, alpha: 0.9 });
        const scale = 12;
        const nxp = normalPrev[0] * scale, nyp = normalPrev[1] * scale;
        const nxc = normalCurr[0] * scale, nyc = normalCurr[1] * scale;
        g.moveTo(centerPrev[0], centerPrev[1]);
        g.lineTo(centerPrev[0] + nxp, centerPrev[1] + nyp);
        g.moveTo(centerPrev[0], centerPrev[1]);
        g.lineTo(centerPrev[0] - nxp, centerPrev[1] - nyp);
        g.moveTo(centerCurr[0], centerCurr[1]);
        g.lineTo(centerCurr[0] + nxc, centerCurr[1] + nyc);
        g.moveTo(centerCurr[0], centerCurr[1]);
        g.lineTo(centerCurr[0] - nxc, centerCurr[1] - nyc);
        g.stroke();
      }
    }
  }

  private runStrokeGeneration(isComplete: boolean = false): void {
    // No dibujar si no hay suficientes puntos para un segmento
    if (!isComplete && this.points.length < 2) return;
    if (isComplete && this.points.length === 0) return;

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
      start: { cap: this.strokeSettings.capStart, taper: this.strokeSettings.taperStart, easing: easingFn },
      end: { cap: this.strokeSettings.capEnd, taper: this.strokeSettings.taperEnd, easing: easingFn },
      last: isComplete,
    } as const;

  const strokePoints = getStrokePoints(this.points as any, strokeOptions as any);
    if (!strokePoints || strokePoints.length === 0) return;

    // Obtener el color RGB (el shader maneja el alfa)
    const color = new Color(this.strokeSettings.strokeColor as any);
    const colorRGB = color.toRgbArray() as [number, number, number];

    // Iterar solo sobre los *nuevos* puntos generados
  let startIndex = this.lastStrokePoint ? strokePoints.findIndex((p: any) => p.point[0] === (this.lastStrokePoint as any).point[0] && p.point[1] === (this.lastStrokePoint as any).point[1]) : 0;
    if (startIndex === -1) startIndex = 0;

    for (let i = startIndex; i < strokePoints.length; i++) {
      const current = strokePoints[i] as any;
      if (!this.lastStrokePoint) {
        this.lastStrokePoint = current;
        continue;
      }
      
      const prev = this.lastStrokePoint as any;
  const distPrev = Math.max(0.0001, (prev.distance as number) ?? 0.0001);
  const distCurr = Math.max(0.0001, (current.distance as number) ?? 0.0001);
  // perfect-freehand's `vector` is the unit normal
  const nPrev = prev.vector as [number, number];
  const nCurr = current.vector as [number, number];
      const pPrev = prev.point as [number, number];
      const pCurr = current.point as [number, number];
      
      // Puntos del trapezoide
  const AL: [number, number] = [pPrev[0] - nPrev[0] * distPrev, pPrev[1] - nPrev[1] * distPrev];
  const AR: [number, number] = [pPrev[0] + nPrev[0] * distPrev, pPrev[1] + nPrev[1] * distPrev];
  const BL: [number, number] = [pCurr[0] - nCurr[0] * distCurr, pCurr[1] - nCurr[1] * distCurr];
  const BR: [number, number] = [pCurr[0] + nCurr[0] * distCurr, pCurr[1] + nCurr[1] * distCurr];

  // El alfa controla la intensidad del blend aditivo
  const alpha = this.strokeSettings.alpha;

      this.meshManager.drawSegment(AL, AR, BL, BR, colorRGB, alpha);
      if (this.debug.enabled) {
        this.debugSegments.push({
          AL, AR, BL, BR,
          centerPrev: [pPrev[0], pPrev[1]],
          centerCurr: [pCurr[0], pCurr[1]],
          normalPrev: [nPrev[0], nPrev[1]],
          normalCurr: [nCurr[0], nCurr[1]],
        });
        // Limit debug memory
        if (this.debugSegments.length > 1000) this.debugSegments.splice(0, this.debugSegments.length - 1000);
      }
      
      this.lastStrokePoint = current;
    }

    // Si se completa, limpiar los puntos
    if (isComplete) {
      this.points = [];
      this.lastStrokePoint = null;
    } else {
      // Mantener solo los últimos puntos para el siguiente cálculo de suavizado
      this.points = this.points.slice(-Math.min(this.points.length, 20));
    }
  }
}
