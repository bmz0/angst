import { Component, effect, inject, signal } from '@angular/core';
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

  protected oscillator1Type = signal<OscillatorType>(this.synthEngineService.getPatch().oscillator1Type);
  protected oscillator2Type = signal<OscillatorType>(this.synthEngineService.getPatch().oscillator2Type);
  protected oscillatorMix = signal(this.synthEngineService.getPatch().oscillator2Amount);
  protected oscillator2SubOctave = signal(this.synthEngineService.getPatch().oscillator2SubOctave);
  protected oscillator2Invert = signal(this.synthEngineService.getPatch().oscillator2Invert);
  protected glideTime = signal(this.synthEngineService.getPatch().glideTime);

  private readonly oscillatorTypes: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

  constructor() {
    effect(() => {
      this.synthEngineService.setParameters({ oscillator1Type: this.oscillator1Type() });
    });
    effect(() => {
      this.synthEngineService.setParameters({ oscillator2Type: this.oscillator2Type() });
    });
  }

  toggleOscillator1Type(): void {
    const currentIndex = this.oscillatorTypes.indexOf(this.oscillator1Type());
    const nextType = this.oscillatorTypes[(currentIndex + 1) % this.oscillatorTypes.length];
    this.oscillator1Type.set(nextType);
  }

  protected onGlideTimeChange(time: number): void {
    this.glideTime.set(time);
    this.synthEngineService.setParameters({ glideTime: time });
  }

  protected onOscillatorMixChange(mix: number): void {
    this.oscillatorMix.set(mix);
    this.synthEngineService.setParameters({
      oscillator1Amount: 1 - mix,
      oscillator2Amount: mix
    });
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
