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
  }

  public onPointerDown(event: VektorPointerEvent, targetLayer: Container): void {
    this.isDrawing = true;
    this.activePointerId = event.pointerId;
    this.points = []; // Reset
    this.lastStrokePoint = null;
    
    this.points.push(...event.points);
    this.runStrokeGeneration(false); // Dibuja el primer punto/segmento
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
    
    // No emitimos VektorObject. El dibujo está "quemado" en la malla.
    console.log('Stop Drawing (LegacyInkTool)');
  }

  public onDeactivate(): void {
    // No-op
  }

  public onRenderPreview(previewGraphics: Graphics): void {
    // No-op
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
      const distPrev = prev.distance as number;
      const distCurr = current.distance as number;
      const vecPrev = prev.vector as [number, number];
      const vecCurr = current.vector as [number, number];
      const pPrev = prev.point as [number, number];
      const pCurr = current.point as [number, number];
      
      // Puntos del trapezoide
      const AL: [number, number] = [pPrev[0] - vecPrev[0] * distPrev, pPrev[1] - vecPrev[1] * distPrev];
      const AR: [number, number] = [pPrev[0] + vecPrev[0] * distPrev, pPrev[1] + vecPrev[1] * distPrev];
      const BL: [number, number] = [pCurr[0] - vecCurr[0] * distCurr, pCurr[1] - vecCurr[1] * distCurr];
      const BR: [number, number] = [pCurr[0] + vecCurr[0] * distCurr, pCurr[1] + vecCurr[1] * distCurr];

  // El alfa controla la intensidad del blend aditivo
  const alpha = this.strokeSettings.alpha;

      this.meshManager.drawSegment(AL, AR, BL, BR, colorRGB, alpha);
      
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
