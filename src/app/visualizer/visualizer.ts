import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { drawWaveform } from '../utils/visualizer.js';

@Component({
  selector: 'osc-visualizer',
  template: '<canvas #canvas></canvas>',
  styleUrls: ['./visualizer.css'],
  standalone: true
})
export class Visualizer implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() analyser?: AnalyserNode;
  
  private canvasContext?: CanvasRenderingContext2D;
  private animationId?: number;

  ngAfterViewInit(): void {
    this.canvasContext = this.canvasRef.nativeElement.getContext('2d')!;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  public start(): void {
    if (!this.analyser || !this.canvasContext) return;

    const canvas = this.canvasRef.nativeElement;

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      drawWaveform(this.analyser!, canvas, this.canvasContext!);
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
