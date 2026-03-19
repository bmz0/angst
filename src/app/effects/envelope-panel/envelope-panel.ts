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

  protected envelopeAttack = signal(this.synthEngineService.getPatch().envelopeAttack);
  protected envelopeDecay = signal(this.synthEngineService.getPatch().envelopeDecay);
  protected envelopeSustain = signal(this.synthEngineService.getPatch().envelopeSustain);
  protected envelopeRelease = signal(this.synthEngineService.getPatch().envelopeRelease);

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
