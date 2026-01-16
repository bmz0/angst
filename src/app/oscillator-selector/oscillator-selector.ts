import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OscillatorType } from '../utils/oscillator.js';

@Component({
  selector: 'oscillator-selector',
  templateUrl: './oscillator-selector.html',
  styleUrls: ['./oscillator-selector.css'],
  standalone: true,
  imports: [FormsModule]
})
export class OscillatorSelector {
  @Input() selectedType: OscillatorType = 'sine';
  @Output() typeSelected = new EventEmitter<OscillatorType>();

  protected oscillatorType: OscillatorType = 'sine';

  protected readonly oscillatorTypes: Array<{ value: OscillatorType; label: string; path: string }> = [
    { value: 'sine', label: 'Sine', path: 'M0,12 Q6,0 12,12 T24,12' },
    { value: 'square', label: 'Square', path: 'M0,20 L0,4 L12,4 L12,20 L24,20 L24,4' },
    { value: 'sawtooth', label: 'Sawtooth', path: 'M0,20 L12,4 L12,20 L24,4' },
    { value: 'triangle', label: 'Triangle', path: 'M0,20 L6,4 L18,20 L24,4' }
  ];

  protected onTypeChange(): void {
    this.typeSelected.emit(this.oscillatorType);
  }
}
