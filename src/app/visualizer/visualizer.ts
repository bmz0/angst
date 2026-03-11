import { Component, viewChild, ElementRef, afterNextRender, DestroyRef, inject } from '@angular/core';
import { drawWaveform } from './canvasDrawer.js';
import { SynthEngineService } from '../services/synth-engine.service.js';

@Component({
  selector: 'osc-visualizer',
  template: '<canvas #canvas></canvas>',
  styleUrls: ['./visualizer.css'],
  standalone: true
})
export class Visualizer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly synthEngineService = inject(SynthEngineService);
  private readonly destroyRef = inject(DestroyRef);
  private canvasContext?: CanvasRenderingContext2D;
  private animationId?: number;

  constructor() {
    afterNextRender(() => {
      this.canvasContext = this.canvasRef().nativeElement.getContext('2d')!;
    });
    this.destroyRef.onDestroy(() => this.stop());
  }

  public start(): void {
    const analyser = this.synthEngineService.getAnalyser();
    if (!analyser || !this.canvasContext) return;
    
    const canvas = this.canvasRef().nativeElement;
    
    const draw = () => {
      if (this.animationId) cancelAnimationFrame(this.animationId)
      this.animationId = requestAnimationFrame(draw);
      drawWaveform(analyser, canvas, this.canvasContext!);
    };
    
    draw();
  }

  public stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }
}
