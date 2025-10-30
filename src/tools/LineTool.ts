import EventEmitter from 'eventemitter3';
import type { ITool, VektorPointerEvent } from './ITool';
import { VektorObject } from '../core/VektorObject';
import type { StrokePoint } from '../types';
import { Graphics, Container, Point } from 'pixi.js';

export class LineTool extends EventEmitter implements ITool {
  private isDrawing = false;
  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;

  public onPointerDown(event: VektorPointerEvent, _targetLayer: Container): void {
    this.isDrawing = true;
    this.startPoint = event.global.clone();
    this.currentPoint = event.global.clone();
  }

  public onPointerMove(event: VektorPointerEvent): void {
    if (!this.isDrawing) return;
    this.currentPoint = event.global.clone();
  }

  public onPointerUp(event: VektorPointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // Final geometry
    const finalLine = new Graphics();
    finalLine.setStrokeStyle({ width: 4, color: 0x00ff00 }); // Verde para depuración
    finalLine.moveTo(this.startPoint!.x, this.startPoint!.y);
    finalLine.lineTo(this.currentPoint!.x, this.currentPoint!.y);
    finalLine.stroke();

    // Create VektorObject
    const points: StrokePoint[] = [
      { x: this.startPoint!.x, y: this.startPoint!.y, pressure: event.pressure ?? 1, timeStamp: event.nativeEvent?.timeStamp ?? 0 },
      { x: this.currentPoint!.x, y: this.currentPoint!.y, pressure: event.pressure ?? 1, timeStamp: event.nativeEvent?.timeStamp ?? 0 },
    ];

    const finalObject = new VektorObject({
      points,
      geometry: finalLine,
    });

    this.emit('strokeComplete', finalObject);

    // Reset state
    this.startPoint = null;
    this.currentPoint = null;
  }

  public onRenderPreview(previewGraphics: Graphics): void {
    if (!this.isDrawing || !this.startPoint || !this.currentPoint) return;

    previewGraphics.setStrokeStyle({ width: 1, color: 0x00ff00, alpha: 0.7 });
    previewGraphics.moveTo(this.startPoint.x, this.startPoint.y);
    previewGraphics.lineTo(this.currentPoint.x, this.currentPoint.y);
    previewGraphics.stroke();
  }

  public onDeactivate(): void {
    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoint = null;
  }
}
