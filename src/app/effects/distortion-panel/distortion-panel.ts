import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'distortion-panel',
  templateUrl: './distortion-panel.html',
  styleUrl: './distortion-panel.css',
  standalone: true
})
export class DistortionPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected distortionEnabled = signal(this.synthEngineService.getPatch().distortionEnabled);
  protected distortionAmount = signal(this.synthEngineService.getPatch().distortionAmount);
  protected distortionFold = signal(this.synthEngineService.getPatch().distortionType === 'fold');

  protected toggleDistortion(): void {
    this.distortionEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({ distortion: { enabled: this.distortionEnabled() } });
  }

  protected onDistortionAmountChange(amount: number): void {
    this.distortionAmount.set(amount);
    this.synthEngineService.setParameters({ distortion: { amount: this.distortionAmount() } });
  }

  protected toggleDistortionFold(): void {
    this.distortionFold.update(fold => !fold);
    this.synthEngineService.setParameters({
      distortion: { type: this.distortionFold() ? 'fold' : 'soft' }
    });
  }
}
