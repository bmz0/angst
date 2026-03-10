import { Component, inject, signal } from '@angular/core';
import { SynthEngineService } from '../../services/synth-engine.service.js';

@Component({
  selector: 'envelope-panel',
  templateUrl: './envelope-panel.html',
  styleUrl: './envelope-panel.css',
  standalone: true
})
export class EnvelopePanel {
  private readonly synthEngineService = inject(SynthEngineService);

  protected envelopeAttack = signal(0.005);
  protected envelopeDecay = signal(0.1);
  protected envelopeSustain = signal(0.7);
  protected envelopeRelease = signal(0.5);

  getRelease(): number {
    return this.envelopeRelease();
  }

  protected onEnvelopeAttackChange(attack: number): void {
    this.envelopeAttack.set(attack);
    this.synthEngineService.setParameters({ envelope: { attack: this.envelopeAttack() } });
  }

  protected onEnvelopeDecayChange(decay: number): void {
    this.envelopeDecay.set(decay);
    this.synthEngineService.setParameters({ envelope: { decay: this.envelopeDecay() } });
  }

  protected onEnvelopeSustainChange(sustain: number): void {
    this.envelopeSustain.set(sustain);
    this.synthEngineService.setParameters({ envelope: { sustain: this.envelopeSustain() } });
  }

  protected onEnvelopeReleaseChange(release: number): void {
    this.envelopeRelease.set(release);
    this.synthEngineService.setParameters({ envelope: { release: this.envelopeRelease() } });
  }
}
