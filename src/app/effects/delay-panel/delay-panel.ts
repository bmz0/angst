import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'delay-panel',
  templateUrl: './delay-panel.html',
  styleUrl: './delay-panel.css',
  standalone: true
})
export class DelayPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected delayEnabled = signal(this.synthEngineService.getPatch().delayEnabled);
  protected delayTime = signal(this.synthEngineService.getPatch().delayTime);
  protected delayFeedback = signal(this.synthEngineService.getPatch().delayFeedback);
  protected delayMix = signal(this.synthEngineService.getPatch().delayMix);
  protected delayPingPong = signal(this.synthEngineService.getPatch().delayPingPong);
  protected delayPan = signal(this.synthEngineService.getPatch().delayPan);

  protected getDelayPanLabel(): string {
    const pan = this.delayPan();
    if (pan < 0) return `L ${Math.round(-pan * 100)}%`;
    if (pan > 0) return `R ${Math.round(pan * 100)}%`;
    return 'C 0%';
  }

  protected toggleDelay(): void {
    this.delayEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({
      delay: { enabled: this.delayEnabled(), mix: this.delayMix() }
    });
  }

  protected onDelayTimeChange(time: number): void {
    this.delayTime.set(time);
    this.synthEngineService.setParameters({ delay: { delayTime: this.delayTime() } });
  }

  protected onDelayFeedbackChange(feedback: number): void {
    this.delayFeedback.set(feedback);
    this.synthEngineService.setParameters({ delay: { feedback: this.delayFeedback() } });
  }

  protected onDelayMixChange(mix: number): void {
    this.delayMix.set(mix);
    this.synthEngineService.setParameters({ delay: { mix: this.delayMix() } });
  }

  protected togglePingPong(): void {
    this.delayPingPong.update(v => !v);
    this.synthEngineService.setParameters({ delay: { pingPong: this.delayPingPong() } });
  }

  protected onDelayPanChange(pan: number): void {
    this.delayPan.set(pan);
    this.synthEngineService.setParameters({ delay: { delayPan: this.delayPan() } });
  }
}
