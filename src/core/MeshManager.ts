import { Geometry, Mesh, State, Shader, Application, Container, Color } from 'pixi.js';
import { vertexSrc, fragmentSrc } from '../shaders';

export class MeshManager {
    private app: Application;
    private mesh: any;
    private geometry!: Geometry;
    private shader!: Shader;

    private posBuffer!: Float32Array;
    private colorBuffer!: Float32Array;
    private indexBuffer!: Uint16Array;
    private segmentCapacity = 0;
    private vertCount = 0;
    private colorCount = 0;
    private indexCount = 0;

    constructor(app: Application) {
        this.app = app;

    // 1. Crear el Shader usando el constructor de alto nivel
    // que maneja los #includes automáticamente.
    this.shader = Shader.from({ gl: { vertex: vertexSrc, fragment: fragmentSrc, name: 'legacy-ink-shader' } });

        // 2. Inicializar búferes y geometría
        this.init(1000); // Capacidad inicial de 1000 segmentos

        // 3. Crear el Mesh
    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
        
        // 4. ¡LA CLAVE! Establecer el BlendMode Aditivo
    const state = new State();
    state.blendMode = 'add' as any; // Pixi v8 accepts string blend modes; typings may vary
        this.mesh.state = state;
        this.mesh.label = 'LegacyInkLayer_Mesh';
    }

    public getMesh(): Mesh {
        return this.mesh;
    }

    private init(initialSegments: number) {
        this.segmentCapacity = Math.max(16, initialSegments | 0);
        const vertCapacity = this.segmentCapacity * 4;
        const posCapacityFloats = vertCapacity * 2;
        const colorCapacityFloats = vertCapacity * 4;
        const indexCapacity = this.segmentCapacity * 6;

        this.posBuffer = new Float32Array(posCapacityFloats);
        this.colorBuffer = new Float32Array(colorCapacityFloats);
        this.indexBuffer = new Uint16Array(indexCapacity);
        
        this.vertCount = 0;
        this.colorCount = 0;
        this.indexCount = 0;

            const geom = new Geometry();
            // Usar cast a any porque las firmas de addAttribute en las defs de Pixi pueden diferir
            (geom as any).addAttribute('aPosition', this.posBuffer, 2);
            (geom as any).addAttribute('aColor', this.colorBuffer, 4);
        geom.addIndex(this.indexBuffer);
        this.geometry = geom;
    }

    private ensureCapacity(extraSegments: number) {
        const usedSegments = this.indexCount / 6 | 0;
        const needed = usedSegments + extraSegments;
        if (needed <= this.segmentCapacity) return;

        let newCapacity = this.segmentCapacity;
        while (newCapacity < needed) newCapacity *= 2;

        const newVertCapacity = newCapacity * 4;
        const newPosFloats = newVertCapacity * 2;
        const newColorFloats = newVertCapacity * 4;
        const newIndexCapacity = newCapacity * 6;

        const newPos = new Float32Array(newPosFloats);
        newPos.set(this.posBuffer.subarray(0, this.vertCount));
        const newCol = new Float32Array(newColorFloats);
        newCol.set(this.colorBuffer.subarray(0, this.colorCount));
        const newIdx = new Uint16Array(newIndexCapacity);
        newIdx.set(this.indexBuffer.subarray(0, this.indexCount));

        this.segmentCapacity = newCapacity;
        this.posBuffer = newPos;
        this.colorBuffer = newCol;
        this.indexBuffer = newIdx;

            const newGeom = new Geometry();
            (newGeom as any).addAttribute('aPosition', this.posBuffer, 2);
            (newGeom as any).addAttribute('aColor', this.colorBuffer, 4);
        newGeom.addIndex(this.indexBuffer);
        this.mesh.geometry = newGeom;
        this.geometry = newGeom;
    }

    public drawSegment(
        AL: [number, number], AR: [number, number], 
        BL: [number, number], BR: [number, number], 
        colorRGB: [number, number, number], baseAlpha: number
    ) {
        this.ensureCapacity(1);
        const alpha = Math.max(0, Math.min(1, baseAlpha));

        // Usamos coordenadas de mundo en pixeles; el shader aplicará local + proyección
        const [alx, aly] = AL;
        const [arx, ary] = AR;
        const [blx, bly] = BL;
        const [brx, bry] = BR;

        const baseVertex = (this.vertCount / 2) | 0;

        let p = this.vertCount;
        const pb = this.posBuffer;
        pb[p++] = alx; pb[p++] = aly;
        pb[p++] = arx; pb[p++] = ary;
        pb[p++] = blx; pb[p++] = bly;
        pb[p++] = brx; pb[p++] = bry;
        this.vertCount = p;

        let c = this.colorCount;
        const cb = this.colorBuffer;
        for (let i = 0; i < 4; i++) {
            cb[c++] = colorRGB[0];
            cb[c++] = colorRGB[1];
            cb[c++] = colorRGB[2];
            cb[c++] = alpha;
        }
        this.colorCount = c;

        let ii = this.indexCount;
        const ib = this.indexBuffer;
        ib[ii++] = baseVertex + 0; ib[ii++] = baseVertex + 1; ib[ii++] = baseVertex + 2;
        ib[ii++] = baseVertex + 1; ib[ii++] = baseVertex + 3; ib[ii++] = baseVertex + 2;
        this.indexCount = ii;

    // Subir solo la porción usada de cada buffer para que el draw use el rango correcto
    const posUsed = this.posBuffer.subarray(0, this.vertCount);
    const colUsed = this.colorBuffer.subarray(0, this.colorCount);
    const idxUsed = this.indexBuffer.subarray(0, this.indexCount);
    (this.geometry as any).getAttribute('aPosition').buffer.update(posUsed);
    (this.geometry as any).getAttribute('aColor').buffer.update(colUsed);
    (this.geometry as any).getIndex().update(idxUsed);
    }

    public clear() {
        this.vertCount = 0;
        this.colorCount = 0;
        this.indexCount = 0;
        // No es necesario llenar el buffer de índices, solo actualizar el contador
    const posUsed = this.posBuffer.subarray(0, this.vertCount);
    const colUsed = this.colorBuffer.subarray(0, this.colorCount);
    const idxUsed = this.indexBuffer.subarray(0, this.indexCount);
    (this.geometry as any).getAttribute('aPosition').buffer.update(posUsed);
    (this.geometry as any).getAttribute('aColor').buffer.update(colUsed);
    (this.geometry as any).getIndex().update(idxUsed);
    }
}
