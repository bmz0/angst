import { Component, inject, signal } from '@angular/core';
import { OscillatorSelector } from '../../oscillator-selector/oscillator-selector.js';
import { OscillatorType } from '../../utils/oscillator.js';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'oscillator-panel',
  templateUrl: './oscillator-panel.html',
  styleUrl: './oscillator-panel.css',
  standalone: true,
  imports: [OscillatorSelector]
})
export class OscillatorPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected oscillator1Type = signal<OscillatorType>('sine');
  protected oscillator2Type = signal<OscillatorType>('square');
  protected oscillator2Amount = signal(1);
  protected oscillator2SubOctave = signal(true);
  protected oscillator2Invert = signal(false);
  protected glideTime = signal(0);

  private readonly oscillatorTypes: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

  toggleOscillator1Type(): void {
    const currentIndex = this.oscillatorTypes.indexOf(this.oscillator1Type());
    const nextType = this.oscillatorTypes[(currentIndex + 1) % this.oscillatorTypes.length];
    this.oscillator1Type.set(nextType);
    this.synthEngineService.setParameters({ oscillator1Type: nextType });
  }

  protected onOscillator1TypeSelected(type: OscillatorType): void {
    this.oscillator1Type.set(type);
    this.synthEngineService.setParameters({ oscillator1Type: type });
  }

  protected onOscillator2TypeSelected(type: OscillatorType): void {
    this.oscillator2Type.set(type);
    this.synthEngineService.setParameters({ oscillator2Type: type });
  }

  protected onGlideTimeChange(time: number): void {
    this.glideTime.set(time);
    this.synthEngineService.setParameters({ glideTime: time });
  }

  protected onOscillator2AmountChange(amount: number): void {
    this.oscillator2Amount.set(amount);
    this.synthEngineService.setParameters({ oscillator2Amount: amount });
  }

  protected toggleOscillator2SubOctave(): void {
    this.oscillator2SubOctave.update(enabled => !enabled);
    this.synthEngineService.setParameters({ oscillator2SubOctave: this.oscillator2SubOctave() });
  }

  protected onOscillator2InvertChange(): void {
    this.oscillator2Invert.update(invert => !invert);
    this.synthEngineService.setParameters({ oscillator2Invert: this.oscillator2Invert() });
  }
}
