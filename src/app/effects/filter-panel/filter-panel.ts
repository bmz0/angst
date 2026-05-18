import { Component, inject, signal } from '@angular/core';
import { SupportedFilterType } from '../../utils/filter.js';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'filter-panel',
  templateUrl: './filter-panel.html',
  styleUrl: './filter-panel.css',
  standalone: true
})
export class FilterPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected filterEnabled = signal(this.synthEngineService.getPatch().filterEnabled);
  protected filterType = signal<SupportedFilterType>(this.synthEngineService.getPatch().filterType);
  protected filterFrequency = signal(this.synthEngineService.getPatch().filterFrequency);
  protected filterQ = signal(this.synthEngineService.getPatch().filterQ);
  protected filterKeyboardTracking = signal(this.synthEngineService.getPatch().filterKeyboardTracking);
  protected filterPostGain = signal(this.synthEngineService.getPatch().filterPostGain);
  protected filterMix = signal(this.synthEngineService.getPatch().filterMix);

  protected readonly filterTypes: SupportedFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];

  protected toggleFilter(): void {
    this.filterEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({ filter: { enabled: this.filterEnabled() } });
  }

  protected onFilterTypeChange(event: Event): void {
    const type = (event.target as HTMLSelectElement).value as SupportedFilterType;
    this.filterType.set(type);
    this.synthEngineService.setParameters({ filter: { type } });
  }

  protected onFilterFrequencyChange(frequency: number): void {
    this.filterFrequency.set(frequency);
    this.synthEngineService.setParameters({ filter: { frequency: this.filterFrequency() } });
  }

  protected onFilterQChange(q: number): void {
    this.filterQ.set(q);
    this.synthEngineService.setParameters({ filter: { Q: this.filterQ() } });
  }

  protected onFilterKeyboardTrackingChange(amount: number): void {
    this.filterKeyboardTracking.set(amount);
    this.synthEngineService.setParameters({ filter: { keyboardTracking: this.filterKeyboardTracking() } });
  }

  protected onFilterPostGainChange(amount: number): void {
    this.filterPostGain.set(amount);
    this.synthEngineService.setParameters({ filter: { postGain: this.filterPostGain() } });
  }

  protected onFilterMixChange(mix: number): void {
    this.filterMix.set(mix);
    this.synthEngineService.setParameters({ filter: { mix: this.filterMix() } });
  }
}
