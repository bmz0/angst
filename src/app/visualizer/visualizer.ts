import { Component, viewChild, ElementRef, afterNextRender, DestroyRef, inject, signal, input } from '@angular/core';
import { drawWaveform, drawSpectrum } from './canvasDrawer.js';
import { SynthEngineService } from '../services/synth-engine.service.js';

type DisplayMode = 'time' | 'frequency';

@Component({
  selector: 'osc-visualizer',
  templateUrl: './visualizer.html',
  styleUrls: ['./visualizer.css'],
  standalone: true
})
export class Visualizer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Optional override — pass an AnalyserNode directly instead of using SynthEngineService. */
  readonly analyserOverride = input<AnalyserNode | undefined>(undefined);

  private readonly synthEngineService = inject(SynthEngineService);
  private readonly destroyRef = inject(DestroyRef);
  private canvasContext?: CanvasRenderingContext2D;
  private animationId?: number;

  protected readonly displayMode = signal<DisplayMode>('time');

  constructor() {
    afterNextRender(() => {
      this.canvasContext = this.canvasRef().nativeElement.getContext('2d')!;
    });
    this.destroyRef.onDestroy(() => this.stop());
  }

  protected toggleMode(): void {
    this.displayMode.update(m => m === 'time' ? 'frequency' : 'time');
  }

  public start(): void {
    const analyser = this.analyserOverride() ?? this.synthEngineService.getAnalyser();
    if (!analyser || !this.canvasContext) return;
    
    const canvas = this.canvasRef().nativeElement;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const peaks = new Float32Array(canvas.width);
    const peakTimestamps = new Float64Array(canvas.width);
    const canvasBackground = getComputedStyle(canvas).getPropertyValue('--canvas-background') || 'white';
    const canvasLine = getComputedStyle(canvas).getPropertyValue('--canvas-line') || 'black';
    
    const draw = () => {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame(draw);
      if (this.displayMode() === 'time') {
        drawWaveform(analyser, canvas, this.canvasContext!, dataArray, canvasBackground, canvasLine);
      } else {
        drawSpectrum(analyser, canvas, this.canvasContext!, dataArray, peaks, peakTimestamps, performance.now(), canvasBackground, canvasLine);
      }
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
