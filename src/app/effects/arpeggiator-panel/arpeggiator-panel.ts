import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { ArpeggiatorController } from '../../utils/arpeggiator.js';
import { DEFAULT_PATCH } from '../../synth/synth-patch.js';

@Component({
  selector: 'arpeggiator-panel',
  templateUrl: './arpeggiator-panel.html',
  styleUrl: './arpeggiator-panel.css',
  standalone: true
})
export class ArpeggiatorPanel {
  stoppedWhilePlaying = output<void>();

  protected arpeggiatorEnabled = signal(DEFAULT_PATCH.arpeggiatorEnabled);
  protected arpeggiatorTempo = signal(DEFAULT_PATCH.arpeggiatorTempo);
  protected arpeggiatorPattern = signal(DEFAULT_PATCH.arpeggiatorPattern);

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

    if (!this.arpeggiatorEnabled() && this.arpeggiatorController.isRunning()) {
      this.arpeggiatorController.stop();
      this.stoppedWhilePlaying.emit();
    }
  }

  protected onArpeggiatorTempoChange(tempo: number): void {
    this.arpeggiatorTempo.set(tempo);
    this.arpeggiatorController.setTempo(tempo);
  }

  protected onArpeggiatorPatternChange(pattern: string): void {
    this.arpeggiatorPattern.set(pattern);
    this.arpeggiatorController.setPattern(pattern);
  }
}
