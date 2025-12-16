import { Component, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { getFrequency } from '../utils/common.js';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-synth',
  imports: [FormsModule],
  styleUrls: ['./synth.css'],
  template: `
    <canvas #canvas></canvas>
    <br>
    <select [(ngModel)]="oscillatorType" (ngModelChange)="onOscillatorTypeChange()">
      <option value="sine">Sine</option>
      <option value="square">Square</option>
      <option value="sawtooth">Sawtooth</option>
      <option value="triangle">Triangle</option>
    </select>
    <br>
    <button (click)="play('C4')">C</button>
    <button (click)="play('C#4')">C#</button>
    <button (click)="play('D4')">D</button>
    <button (click)="play('D#4')">D#</button>
    <button (click)="play('E4')">E</button>
    <button (click)="play('F4')">F</button>
    <button (click)="play('F#4')">F#</button>
    <button (click)="play('G4')">G</button>
    <button (click)="play('G#4')">G#</button>
    <button (click)="play('A4')">A</button>
    <button (click)="play('A#4')">A#</button>
    <button (click)="play('B4')">B</button>
    <button (click)="play('C5')">C</button>
    <br>
    <button (click)="stop()">Stop</button>
  `,
  standalone: true
})
export class Synth implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private audioContext?: AudioContext;
  private oscillator?: OscillatorNode;
  private analyser?: AnalyserNode;
  private canvasContext?: CanvasRenderingContext2D;
  private animationId?: number;
  private lastPlayedFrequency?: number;
  protected isPlaying = false;
  protected oscillatorType: OscillatorType = 'sine';

  private readonly oscillatorTypes: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

  private readonly keyMap: Record<string, string> = {
    'KeyA': 'C4',
    'KeyW': 'C#4',
    'KeyS': 'D4',
    'KeyE': 'D#4',
    'KeyD': 'E4',
    'KeyF': 'F4',
    'KeyT': 'F#4',
    'KeyG': 'G4',
    'KeyY': 'G#4',
    'KeyH': 'A4',
    'KeyU': 'A#4',
    'KeyJ': 'B4',
    'KeyK': 'C5'
  };

  ngAfterViewInit(): void {
    this.canvasContext = this.canvasRef.nativeElement.getContext('2d')!;
  }

  @HostListener('window:keydown', ['$event'])
  protected handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      event.preventDefault();
      this.stop();
      return;
    }

    if (event.code === 'KeyO') {
      event.preventDefault();
      this.toggleOscillatorType();
      return;
    }

    const note = this.keyMap[event.code];
    if (note) {
      event.preventDefault();
      this.play(note);
    }
  }

  private toggleOscillatorType(): void {
    const currentIndex = this.oscillatorTypes.indexOf(this.oscillatorType);
    const nextIndex = (currentIndex + 1) % this.oscillatorTypes.length;
    this.oscillatorType = this.oscillatorTypes[nextIndex];
    this.onOscillatorTypeChange();
  }

  protected onOscillatorTypeChange(): void {
    if (this.isPlaying && this.lastPlayedFrequency) {
      this.stop();
      this.playFrequency(this.lastPlayedFrequency);
    }
  }

  protected play(note: string): void {
    this.stop();
    const frequency = getFrequency(note);
    this.playFrequency(frequency);
  }

  private playFrequency(frequency: number): void {
    this.lastPlayedFrequency = frequency;
    
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.5;
      this.analyser.connect(this.audioContext.destination);
    }
    
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = this.oscillatorType;
    this.oscillator.frequency.value = frequency;
    this.oscillator.connect(this.analyser!);
    this.oscillator.start();
    this.isPlaying = true;
    
    this.visualize();
  }

  private visualize(): void {
    if (!this.analyser || !this.canvasContext) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.width;
    const height = canvas.height;
    const canvasBackground = getComputedStyle(canvas).getPropertyValue('--canvas-background') || 'white';
    const canvasLine = getComputedStyle(canvas).getPropertyValue('--canvas-line') || 'black';

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      
      this.analyser!.getByteTimeDomainData(dataArray);
      
      this.canvasContext!.fillStyle = canvasBackground
      this.canvasContext!.fillRect(0, 0, width, height);
      
      this.canvasContext!.lineWidth = 2;
      this.canvasContext!.strokeStyle = canvasLine;
      this.canvasContext!.beginPath();
      
      const sliceWidth = width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
          this.canvasContext!.moveTo(x, y);
        } else {
          this.canvasContext!.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      this.canvasContext!.lineTo(width, height / 2);
      this.canvasContext!.stroke();
    };
    
    draw();
  }

  protected stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    this.oscillator?.stop();
    this.oscillator = undefined;
    this.isPlaying = false;
  }
}