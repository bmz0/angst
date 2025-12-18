import { Component, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { getFrequency } from '../utils/common.js';
import { drawWaveform } from '../utils/visualizer.js';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-synth',
  imports: [FormsModule],
  templateUrl: './synth.html',
  styleUrls: ['./synth.css'],
  standalone: true
})
export class Synth implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private audioContext?: AudioContext;
  private oscillator?: OscillatorNode;
  private analyser?: AnalyserNode;
  private gainNode?: GainNode;
  private waveShaperNode?: WaveShaperNode;
  private frequencyParam?: AudioParam;
  private canvasContext?: CanvasRenderingContext2D;
  private animationId?: number;
  private lastPlayedFrequency?: number;
  protected isPlaying = false;
  protected oscillatorType: OscillatorType = 'sine';
  protected gain = 1;
  protected glideTime = 0;
  protected currentOctave = 4;

  private readonly oscillatorTypes: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

  private readonly keyMap: Record<string, string> = {
    'KeyA': 'C',
    'KeyW': 'C#',
    'KeyS': 'D',
    'KeyE': 'D#',
    'KeyD': 'E',
    'KeyF': 'F',
    'KeyT': 'F#',
    'KeyG': 'G',
    'KeyY': 'G#',
    'KeyH': 'A',
    'KeyU': 'A#',
    'KeyJ': 'B',
    'KeyK': 'C'
  };

  ngAfterViewInit(): void {
    this.canvasContext = this.canvasRef.nativeElement.getContext('2d')!;
  }

  protected init(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.gain;
      this.waveShaperNode = this.audioContext.createWaveShaper();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.5;
      this.waveShaperNode.curve = new Float32Array([-1.2, 0, 1.5]);
      this.gainNode.connect(this.waveShaperNode);
      this.waveShaperNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  protected onGainChange(): void {
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.gain, this.audioContext.currentTime);
    }
  }

  @HostListener('window:keydown', ['$event'])
  protected handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape' || event.code === 'Space') {
      event.preventDefault();
      this.stop();
      return;
    }

    if (event.code === 'KeyO') {
      event.preventDefault();
      this.toggleOscillatorType();
      return;
    }

    if (event.code === 'Comma') {
      event.preventDefault();
      this.decrementOctave();
      return;
    }

    if (event.code === 'Period') {
      event.preventDefault();
      this.incrementOctave();
      return;
    }

    const note = this.keyMap[event.code];
    if (note) {
      event.preventDefault();
      const octaveOffset = note === 'C' && event.code === 'KeyK' ? 1 : 0;
      this.play(note, octaveOffset);
    }
  }

  private incrementOctave(): void {
    if (this.currentOctave < 9) {
      this.currentOctave++;
    }
  }

  private decrementOctave(): void {
    if (this.currentOctave > 0) {
      this.currentOctave--;
    }
  }

  private toggleOscillatorType(): void {
    const currentIndex = this.oscillatorTypes.indexOf(this.oscillatorType);
    const nextIndex = (currentIndex + 1) % this.oscillatorTypes.length;
    this.oscillatorType = this.oscillatorTypes[nextIndex];
    this.onOscillatorTypeChange();
  }

  protected onOscillatorTypeChange(): void {
    if (this.isPlaying && this.oscillator) {
      const frequency = this.oscillator.frequency.value;
      this.stop();
      this.playFrequency(frequency);
    }
  }

  protected play(note: string, octaveOffset: number = 0): void {
    this.stop();
    const noteWithOctave = `${note}${this.currentOctave + octaveOffset}`;
    const frequency = getFrequency(noteWithOctave);
    this.playFrequency(frequency);
  }

  private playFrequency(frequency: number): void {    

    if (!this.audioContext) return;
    
    this.oscillator = this.audioContext!.createOscillator();
    this.oscillator.type = this.oscillatorType;
    this.frequencyParam = this.oscillator.frequency;
    
    if (this.glideTime === 0 || !this.lastPlayedFrequency) {
      this.frequencyParam.setValueAtTime(frequency, this.audioContext.currentTime);
    } else {
      this.frequencyParam.setValueAtTime(this.lastPlayedFrequency, this.audioContext.currentTime);
      this.frequencyParam.linearRampToValueAtTime(frequency, this.audioContext.currentTime + this.glideTime);
    }

    this.lastPlayedFrequency = frequency;
    
    this.oscillator.connect(this.gainNode!);
    this.oscillator.start();
    this.isPlaying = true;
    
    this.visualize();
  }

  private visualize(): void {
    if (!this.analyser || !this.canvasContext) return;

    const canvas = this.canvasRef.nativeElement;

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      drawWaveform(this.analyser!, canvas, this.canvasContext!);
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
