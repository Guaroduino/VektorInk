declare module 'tess2' {
  export interface TesselateOptions {
    contours: number[][];
    windingRule: number;
    elementType: number;
    polySize: number;
    vertexSize: number;
  }
  export interface TesselateResult {
    vertices: number[];
    elements: number[];
  }
  const Tess2: {
    WINDING_ODD: number;
    POLYGONS: number;
    tesselate(options: TesselateOptions): TesselateResult;
  };
  export default Tess2;
}
