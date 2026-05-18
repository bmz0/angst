import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'ladder-filter-panel',
  templateUrl: './ladder-filter-panel.html',
  styleUrl: './ladder-filter-panel.css',
  standalone: true
})
export class LadderFilterPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected ladderFilterEnabled = signal(this.synthEngineService.getPatch().ladderFilterEnabled);
  protected ladderFilterFrequency = signal(this.synthEngineService.getPatch().ladderFilterFrequency);
  protected ladderFilterResonance = signal(this.synthEngineService.getPatch().ladderFilterResonance);
  protected ladderFilterDrive = signal(this.synthEngineService.getPatch().ladderFilterDrive);
  protected ladderFilterKeyboardTracking = signal(this.synthEngineService.getPatch().ladderFilterKeyboardTracking);
  protected ladderFilterPostGain = signal(this.synthEngineService.getPatch().ladderFilterPostGain);

  protected toggleFilter(): void {
    this.ladderFilterEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({ ladderFilter: { enabled: this.ladderFilterEnabled() } });
  }

  protected onFrequencyChange(frequency: number): void {
    this.ladderFilterFrequency.set(frequency);
    this.synthEngineService.setParameters({ ladderFilter: { frequency } });
  }

  protected onResonanceChange(resonance: number): void {
    this.ladderFilterResonance.set(resonance);
    this.synthEngineService.setParameters({ ladderFilter: { resonance } });
  }

  protected onDriveChange(drive: number): void {
    this.ladderFilterDrive.set(drive);
    this.synthEngineService.setParameters({ ladderFilter: { drive } });
  }

  protected onKeyboardTrackingChange(amount: number): void {
    this.ladderFilterKeyboardTracking.set(amount);
    this.synthEngineService.setParameters({ ladderFilter: { keyboardTracking: amount } });
  }

  protected onPostGainChange(amount: number): void {
    this.ladderFilterPostGain.set(amount);
    this.synthEngineService.setParameters({ ladderFilter: { postGain: amount } });
  }
}
