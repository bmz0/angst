import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'reverb-panel',
  templateUrl: './reverb-panel.html',
  styleUrl: './reverb-panel.css',
  standalone: true
})
export class ReverbPanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected reverbEnabled = signal(this.synthEngineService.getPatch().reverbEnabled);
  protected reverbRoomSize = signal(this.synthEngineService.getPatch().reverbRoomSize);
  protected reverbDecay = signal(this.synthEngineService.getPatch().reverbDecay);
  protected reverbMix = signal(this.synthEngineService.getPatch().reverbMix);
  protected reverbColor = signal(this.synthEngineService.getPatch().reverbColor);
  protected reverbPreDelay = signal(this.synthEngineService.getPatch().reverbPreDelay);

  protected toggleReverb(): void {
    this.reverbEnabled.update(enabled => !enabled);
    this.synthEngineService.setParameters({
      reverb: { enabled: this.reverbEnabled(), mix: this.reverbMix() }
    });
  }

  protected onRoomSizeChange(roomSize: number): void {
    this.reverbRoomSize.set(roomSize);
    this.synthEngineService.setParameters({ reverb: { roomSize: this.reverbRoomSize() } });
  }

  protected onDecayChange(decay: number): void {
    this.reverbDecay.set(decay);
    this.synthEngineService.setParameters({ reverb: { decay: this.reverbDecay() } });
  }

  protected onMixChange(mix: number): void {
    this.reverbMix.set(mix);
    this.synthEngineService.setParameters({ reverb: { mix: this.reverbMix() } });
  }

  protected onColorChange(color: number): void {
    this.reverbColor.set(color);
    this.synthEngineService.setParameters({ reverb: { color: this.reverbColor() } });
  }

  protected onPreDelayChange(preDelay: number): void {
    this.reverbPreDelay.set(preDelay);
    this.synthEngineService.setParameters({ reverb: { preDelay: this.reverbPreDelay() } });
  }

  protected getColorLabel(): string {
    const c = this.reverbColor();
    if (c < -0.33) return 'Dark';
    if (c > 0.33) return 'Bright';
    return 'Neutral';
  }
}
