import { Container } from 'pixi.js';
import type { Graphics } from 'pixi.js';

type VObjectGeom = Graphics | any;
import type { StrokePoint } from '../types';

export interface VektorObjectOptions {
  points: StrokePoint[];
  geometry: VObjectGeom;
}

export class VektorObject extends Container {
  public points: StrokePoint[];
  public vectorRepresentation: VObjectGeom;

  constructor(options: VektorObjectOptions) {
    super();
    this.points = options.points;
    this.vectorRepresentation = options.geometry;

    // Attach the rendered geometry to this container
    this.addChild(this.vectorRepresentation);
  }

  public updateGeometry(newGeometry: VObjectGeom): void {
    // Remove old geometry if it exists
    if (this.vectorRepresentation.parent === this) {
      this.removeChild(this.vectorRepresentation);
    }

    // Destroy previous display object resources when replaced
    if ('destroy' in this.vectorRepresentation && typeof (this.vectorRepresentation as any).destroy === 'function') {
      (this.vectorRepresentation as any).destroy();
    }

    this.vectorRepresentation = newGeometry;
    this.addChild(this.vectorRepresentation);
  }

  public getRawPoints(): StrokePoint[] {
    return this.points;
  }
}
