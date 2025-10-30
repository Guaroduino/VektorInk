import { Graphics, Container, Point } from 'pixi.js';
import type { StrokePoint } from '../types';

export interface VektorPointerEvent {
  global: Point; // La coordenada principal del evento (mapeada a Pixi)
  points: StrokePoint[]; // Todos los puntos (coalesced + principal) con timestamp/pressure preservados
  pressure: number;
  pointerId: number;
  nativeEvent: PointerEvent; // El evento original del DOM
}

export interface ITool {
  onPointerDown(event: VektorPointerEvent, targetLayer: Container): void;
  onPointerMove(event: VektorPointerEvent): void;
  onPointerUp(event: VektorPointerEvent): void;
  onDeactivate(): void;
  onRenderPreview(previewGraphics: Graphics): void;
}
