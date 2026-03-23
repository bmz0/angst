import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'overdrive-panel',
  templateUrl: './overdrive-panel.html',
  styleUrl: './overdrive-panel.css',
  standalone: true
})
export class OverdrivePanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected overdriveEnabled = signal(this.synthEngineService.getPatch().overdriveEnabled);
  protected overdriveAmount = signal(this.synthEngineService.getPatch().overdriveAmount);
  protected overdriveFold = signal(this.synthEngineService.getPatch().overdriveType === 'fold');

  protected toggleOverdrive(): void {
    this.overdriveEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({ overdrive: { enabled: this.overdriveEnabled() } });
  }

  protected onOverdriveAmountChange(amount: number): void {
    this.overdriveAmount.set(amount);
    this.synthEngineService.setParameters({ overdrive: { amount: this.overdriveAmount() } });
  }

  protected toggleOverdriveFold(): void {
    this.overdriveFold.update(fold => !fold);
    this.synthEngineService.setParameters({
      overdrive: { type: this.overdriveFold() ? 'fold' : 'soft' }
    });
  }
}
