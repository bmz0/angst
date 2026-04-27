import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { ArpeggiatorController } from '../../utils/arpeggiator.js';
import { DEFAULT_PATCH } from '../../synth/synth-patch.js';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'arpeggiator-panel',
  templateUrl: './arpeggiator-panel.html',
  styleUrl: './arpeggiator-panel.css',
  standalone: true
})
export class ArpeggiatorPanel {
  stoppedWhilePlaying = output<void>();

  private readonly synthEngineService = inject(SynthEngineService);

  protected arpeggiatorEnabled = signal(this.synthEngineService.getPatch().arpeggiatorEnabled);
  protected arpeggiatorTempo = signal(this.synthEngineService.getPatch().arpeggiatorTempo);
  protected arpeggiatorPattern = signal(this.synthEngineService.getPatch().arpeggiatorPattern);

  private readonly arpeggiatorController = new ArpeggiatorController({
    tempo: DEFAULT_PATCH.arpeggiatorTempo,
    pattern: DEFAULT_PATCH.arpeggiatorPattern,
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.arpeggiatorController.stop());
  }

  isEnabled(): boolean {
    return this.arpeggiatorEnabled();
  }

  start(callback: (semitoneOffset: number) => void): void {
    this.arpeggiatorController.start(callback);
  }

  stop(): void {
    this.arpeggiatorController.stop();
  }

  protected toggleArpeggiator(): void {
    this.arpeggiatorEnabled.update(enabled => !enabled);
    this.synthEngineService.updateArpeggiatorPatch({
      arpeggiatorEnabled: this.arpeggiatorEnabled(),
      arpeggiatorTempo: this.arpeggiatorTempo(),
      arpeggiatorPattern: this.arpeggiatorPattern(),
    });

    if (!this.arpeggiatorEnabled() && this.arpeggiatorController.isRunning()) {
      this.arpeggiatorController.stop();
      this.stoppedWhilePlaying.emit();
    }
  }

  protected onArpeggiatorTempoChange(tempo: number): void {
    this.arpeggiatorTempo.set(tempo);
    this.arpeggiatorController.setTempo(tempo);
    this.synthEngineService.updateArpeggiatorPatch({
      arpeggiatorEnabled: this.arpeggiatorEnabled(),
      arpeggiatorTempo: tempo,
      arpeggiatorPattern: this.arpeggiatorPattern(),
    });
  }

  protected onArpeggiatorPatternChange(pattern: string): void {
    this.arpeggiatorPattern.set(pattern);
    this.arpeggiatorController.setPattern(pattern);
    this.synthEngineService.updateArpeggiatorPatch({
      arpeggiatorEnabled: this.arpeggiatorEnabled(),
      arpeggiatorTempo: this.arpeggiatorTempo(),
      arpeggiatorPattern: pattern,
    });
  }
}
