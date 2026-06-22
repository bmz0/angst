import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'comb-filter-panel',
  templateUrl: './comb-filter-panel.html',
  styleUrl: './comb-filter-panel.css',
  standalone: true
})
export class CombFilterPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected combFilterEnabled = signal(this.synthEngineService.getPatch().combFilterEnabled);
  protected combFilterDelayTime = signal(this.synthEngineService.getPatch().combFilterDelayTime);
  protected combFilterGain = signal(this.synthEngineService.getPatch().combFilterGain);
  protected combFilterFeedback = signal(this.synthEngineService.getPatch().combFilterFeedback);
  protected combFilterPostGain = signal(this.synthEngineService.getPatch().combFilterPostGain);
  protected combFilterKeyboardTracking = signal(this.synthEngineService.getPatch().combFilterKeyboardTracking);

  protected toggleFilter(): void {
    this.combFilterEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({ combFilter: { enabled: this.combFilterEnabled() } });
  }

  protected onDelayTimeChange(delayTime: number): void {
    this.combFilterDelayTime.set(delayTime);
    this.synthEngineService.setParameters({ combFilter: { delayTime } });
  }

  protected onGainChange(gain: number): void {
    this.combFilterGain.set(gain);
    this.synthEngineService.setParameters({ combFilter: { gain } });
  }

  protected toggleFeedback(): void {
    this.combFilterFeedback.update(fb => !fb);
    this.synthEngineService.setParameters({ combFilter: { feedback: this.combFilterFeedback() } });
  }

  protected onPostGainChange(postGain: number): void {
    this.combFilterPostGain.set(postGain);
    this.synthEngineService.setParameters({ combFilter: { postGain } });
  }

  protected onKeyboardTrackingChange(keyboardTracking: number): void {
    this.combFilterKeyboardTracking.set(keyboardTracking);
    this.synthEngineService.setParameters({ combFilter: { keyboardTracking } });
  }

  /** Converts delay time (seconds) to approximate comb fundamental (Hz). */
  protected combFrequency(): string {
    const d = this.combFilterDelayTime();
    // feedforward: first null at 1/(2D), feedback: first peak at 1/D
    const f = this.combFilterFeedback() ? 1 / d : 1 / (2 * d);
    return f >= 1000 ? `${(f / 1000).toFixed(1)}kHz` : `${f.toFixed(0)}Hz`;
  }
}
