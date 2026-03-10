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

  protected filterEnabled = signal(false);
  protected filterType = signal<SupportedFilterType>('lowpass');
  protected filterFrequency = signal(1000);
  protected filterQ = signal(1);
  protected filterKeyboardTracking = signal(0.5);
  protected filterPostGain = signal(1);

  protected readonly filterTypes: SupportedFilterType[] = ['lowpass', 'highpass', 'bandpass'];

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
}
