import { Container, Graphics } from 'pixi.js';
import type { StrokePoint } from '../types';

export interface VektorObjectOptions {
  points: StrokePoint[];
  geometry: Graphics;
}

export class VektorObject extends Container {
  public points: StrokePoint[];
  public vectorRepresentation: Graphics;

  constructor(options: VektorObjectOptions) {
    super();
    this.points = options.points;
    this.vectorRepresentation = options.geometry;

    // Attach the rendered geometry to this container
    this.addChild(this.vectorRepresentation);
  }

  public updateGeometry(newGeometry: Graphics): void {
    // Remove old geometry if it exists
    if (this.vectorRepresentation.parent === this) {
      this.removeChild(this.vectorRepresentation);
    }

    this.vectorRepresentation = newGeometry;
    this.addChild(this.vectorRepresentation);
  }

  public getRawPoints(): StrokePoint[] {
    return this.points;
  }
}
