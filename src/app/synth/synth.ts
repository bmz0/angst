import { Component, HostListener } from '@angular/core';
import { getFrequency } from '../utils/common.js';

@Component({
  selector: 'app-synth',
  template: `
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
export class Synth {
  private audioContext?: AudioContext;
  private oscillator?: OscillatorNode;
  protected isPlaying = false;

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

  @HostListener('window:keydown', ['$event'])
  protected handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      event.preventDefault();
      this.stop();
      return;
    }

    const note = this.keyMap[event.code];
    if (note) {
      event.preventDefault();
      this.play(note);
    }
  }

  protected play(note: string): void {
    this.stop();
    const frequency = getFrequency(note);
    this.playFrequency(frequency);
  }

  private playFrequency(frequency: number): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = frequency;
    this.oscillator.connect(this.audioContext.destination);
    this.oscillator.start();
    this.isPlaying = true;
  }

  protected stop(): void {
    this.oscillator?.stop();
    this.oscillator = undefined;
    this.isPlaying = false;
  }
}