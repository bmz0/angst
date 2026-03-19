import { Component, model } from '@angular/core';
import { OscillatorType } from '../utils/oscillator.js';

let id = 0;
@Component({
  selector: 'oscillator-selector',
  templateUrl: './oscillator-selector.html',
  styleUrls: ['./oscillator-selector.css'],
  standalone: true
})
export class OscillatorSelector {
  selectorId = ++id;

  selectedType = model<OscillatorType>('sine');

  protected readonly oscillatorTypes: Array<{ value: OscillatorType; label: string; path: string }> = [
    { value: 'square', label: 'Square', path: 'M0,20 L0,4 L12,4 L12,20 L24,20 L24,4' },
    { value: 'sawtooth', label: 'Sawtooth', path: 'M0,20 L12,4 L12,20 L24,4' },
    { value: 'triangle', label: 'Triangle', path: 'M0,20 L6,4 L18,20 L24,4' },
    { value: 'sine', label: 'Sine', path: 'M0,12 Q6,0 12,12 T24,12' },
  ];
}
