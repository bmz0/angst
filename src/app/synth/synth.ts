import { Component, ViewChild } from '@angular/core';
import { getFrequency } from '../utils/common.js';
import { FormsModule } from '@angular/forms';
import { Visualizer } from '../visualizer/visualizer.js';
import { Keyboard } from '../keyboard/keyboard.js';
import { OscillatorTypeSelector } from '../oscillator-type-selector/oscillator-type-selector.js';

@Component({
  selector: 'app-synth',
  imports: [FormsModule, Visualizer, Keyboard, OscillatorTypeSelector],
  templateUrl: './synth.html',
  styleUrls: ['./synth.css'],
  standalone: true
})
export class Synth {
  @ViewChild(Visualizer) visualizerRef!: Visualizer;
  
  private audioContext?: AudioContext;
  private oscillator?: OscillatorNode;
  protected analyser?: AnalyserNode;
  private gainNode?: GainNode;
  private waveShaperNode?: WaveShaperNode;
  private frequencyParam?: AudioParam;
  private lastPlayedFrequency?: number;
  protected isPlaying = false;
  protected oscillatorType: OscillatorType = 'sine';
  protected gain = 1;
  protected glideTime = 0;
  protected currentOctave = 4;

  private readonly oscillatorTypes: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

  protected init(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.gain;
      this.waveShaperNode = this.audioContext.createWaveShaper();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.5;
      this.gainNode.connect(this.waveShaperNode);
      this.waveShaperNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  protected onGainChange(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gain;
    }
  }

  protected toggleOscillatorType(): void {
    const currentIndex = this.oscillatorTypes.indexOf(this.oscillatorType);
    const nextIndex = (currentIndex + 1) % this.oscillatorTypes.length;
    this.oscillatorType = this.oscillatorTypes[nextIndex];
    this.onOscillatorTypeChange();
  }

  protected onOscillatorTypeChange(): void {
    if (this.isPlaying && this.lastPlayedFrequency) {
      const frequency = this.lastPlayedFrequency;
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
    if (!this.audioContext) {
      this.init();
    }

    if (!this.audioContext) return;
    
    this.oscillator = this.audioContext.createOscillator();
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
    
    this.visualizerRef.start();
  }

  protected stop(): void {
    this.visualizerRef?.stop();
    this.oscillator?.stop();
    this.oscillator = undefined;
    this.isPlaying = false;
  }
}
