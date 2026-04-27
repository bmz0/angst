import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'rectifier-panel',
  templateUrl: './rectifier-panel.html',
  styleUrl: './rectifier-panel.css',
  standalone: true
})
export class RectifierPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected rectifierEnabled = signal(this.synthEngineService.getPatch().rectifierEnabled);
  protected rectifierFull = signal(this.synthEngineService.getPatch().rectifierMode === 'full');
  // Bias stored as integer [-100, 100] mapped to [-1, 1] inside the controller
  protected rectifierBias = signal(Math.round(this.synthEngineService.getPatch().rectifierBias * 100));

  protected toggleRectifier(): void {
    this.rectifierEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({ rectifier: { enabled: this.rectifierEnabled() } });
  }

  protected toggleRectifierMode(): void {
    this.rectifierFull.update(full => !full);
    this.synthEngineService.setParameters({
      rectifier: { mode: this.rectifierFull() ? 'full' : 'half' }
    });
  }

  protected onBiasChange(value: number): void {
    this.rectifierBias.set(value);
    this.synthEngineService.setParameters({ rectifier: { bias: value / 100 } });
  }
}
