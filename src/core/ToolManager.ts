import type { ITool, VektorPointerEvent } from '../tools/ITool';
import { FreehandTool } from '../tools/FreehandTool';
import { LineTool } from '../tools/LineTool';
import { LegacyInkTool } from '../tools/LegacyInkTool';
import { MeshManager } from './MeshManager';
import { VektorObject } from './VektorObject';
import { Application, Container, Graphics, Point } from 'pixi.js';
import { GUI } from 'lil-gui';
import type { StrokePoint } from '../types';

export class ToolManager {
  private app: Application;
  private gui: GUI;
  private tools = new Map<string, ITool>();
  private activeTool: ITool | null = null;
  private inputTarget!: Container;
  private drawingTarget!: Container;
  private previewLayer!: Graphics;
  private meshManager!: MeshManager;
  private scene: Container;
  private domElement: HTMLElement;
  private lastMappedPoint = new Point();
  private isPointerDown = false;

  constructor(app: Application, gui: GUI, meshManager: MeshManager) {
    this.app = app;
    this.gui = gui;
    this.meshManager = meshManager;
    this.domElement = (this.app.renderer as any).canvas as HTMLElement;

    // Resolver capas desde el stage por nombre (CanvasManager debe configurarlas antes)
    this.inputTarget = this.app.stage.getChildByName('inputLayer') as Container;
    this.drawingTarget = this.app.stage.getChildByName('drawingContainer') as Container;
    this.previewLayer = this.app.stage.getChildByName('previewLayer') as Graphics;

    // Asegurar la escena de objetos vectoriales
    const existingScene = this.drawingTarget?.getChildByName('VektorScene') as Container | null;
    if (existingScene) {
      this.scene = existingScene;
    } else {
      this.scene = new Container();
      this.scene.name = 'VektorScene';
      (this.scene as any).label = 'VektorScene';
      this.drawingTarget?.addChild(this.scene);
    }

    this.registerTools();
  }

  private registerTools(): void {
    const freehandTool = new FreehandTool(this.app, this.gui);
    this.tools.set('freehand', freehandTool);

    freehandTool.on('strokeComplete', (obj: VektorObject) => {
      this.scene.addChild(obj);
    });

    // Registrar LineTool
    const lineTool = new LineTool();
    this.tools.set('line', lineTool);

    // Suscribirse a su evento 'strokeComplete'
    lineTool.on('strokeComplete', (obj: VektorObject) => {
      this.scene.addChild(obj);
    });

    // Registrar LegacyInkTool que dibuja directamente en la capa de MeshManager
    const legacyInkTool = new LegacyInkTool(this.meshManager, this.gui);
    this.tools.set('legacyInk', legacyInkTool);
  }

  public setActiveTool(name: string): void {
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }

    const tool = this.tools.get(name);
    if (tool) {
      this.activeTool = tool;
    } else {
      console.error(`Tool '${name}' not found.`);
      this.activeTool = null;
    }
  }

  public listen(): void {
    this.domElement.addEventListener('pointerdown', this.onNativePointerDown);
    this.domElement.addEventListener('pointermove', this.onNativePointerMove);
    this.domElement.addEventListener('pointerup', this.onNativePointerUp);
    this.domElement.addEventListener('pointerupoutside', this.onNativePointerUp as any);
  }

  public stopListening(): void {
    this.domElement.removeEventListener('pointerdown', this.onNativePointerDown);
    this.domElement.removeEventListener('pointermove', this.onNativePointerMove);
    this.domElement.removeEventListener('pointerup', this.onNativePointerUp);
    this.domElement.removeEventListener('pointerupoutside', this.onNativePointerUp as any);
  }

  private onNativePointerDown = (event: PointerEvent): void => {
    this.isPointerDown = true;
    const vektorEvent = this.mapToVektorEvent(event);
    if (this.activeTool) {
      this.activeTool.onPointerDown(vektorEvent, this.drawingTarget);
    }
  };

  private onNativePointerMove = (event: PointerEvent): void => {
    if (!this.isPointerDown) return;
    const vektorEvent = this.mapToVektorEvent(event);
    if (this.activeTool) {
      this.activeTool.onPointerMove(vektorEvent);
    }
  };

  private onNativePointerUp = (event: PointerEvent): void => {
    this.isPointerDown = false;
    const vektorEvent = this.mapToVektorEvent(event);
    if (this.activeTool) {
      this.activeTool.onPointerUp(vektorEvent);
    }
  };

  private mapToVektorEvent(event: PointerEvent): VektorPointerEvent {
    const points: StrokePoint[] = [];
    const mapFn = (this.app.renderer as any).events.mapPositionToPoint;

    const events = (event.getCoalescedEvents && event.getCoalescedEvents())
      ? event.getCoalescedEvents()
      : [event];

    let lastTimeStamp = -1;

    for (const e of events) {
      const point = new Point();
      mapFn.call((this.app.renderer as any).events, point, e.clientX, e.clientY);

      // Evitar duplicados de tiempo y posición
      if (e.timeStamp === lastTimeStamp || (point.x === this.lastMappedPoint.x && point.y === this.lastMappedPoint.y)) {
        continue;
      }
      
      lastTimeStamp = e.timeStamp;
      this.lastMappedPoint.copyFrom(point);

      points.push({
        x: point.x,
        y: point.y,
        pressure: e.pressure === 0 ? 0.5 : e.pressure,
        timeStamp: e.timeStamp
      });
    }

    // Mapear el punto principal (global) por separado
    const mainPoint = new Point();
    mapFn.call((this.app.renderer as any).events, mainPoint, event.clientX, event.clientY);

    return {
      global: mainPoint,
      points: points,
      pressure: event.pressure === 0 ? 0.5 : event.pressure,
      pointerId: event.pointerId,
      nativeEvent: event
    };
  }

  public renderPreview(): void {
    this.previewLayer.clear();
    if (this.activeTool) {
      this.activeTool.onRenderPreview(this.previewLayer);
    }
  }

  public clearScene(): void {
    if (!this.scene) return;
    const removed = this.scene.removeChildren();
    for (const obj of removed) {
      // Destroy any GPU resources held by the object/children
      try {
        (obj as any).destroy?.({ children: true });
      } catch {
        // ignore
      }
    }
    // Clear any preview graphics too
    this.previewLayer?.clear();
  }
}
