import { Injectable, inject } from '@angular/core';
import { AudioContextService } from './audio-context.service.js';
import { SynthEngine, SynthEngineConfig, SynthEngineParameters } from '../synth/synthEngine.js';
import {
  DEFAULT_PATCH,
  SynthPatch,
  synthPatchToEngineParameters,
} from '../synth/synth-patch.js';

@Injectable({ providedIn: 'root' })
export class SynthEngineService {
  private engine?: SynthEngine;
  private analyser?: AnalyserNode;
  private readonly audioCtx = inject(AudioContextService);
  private currentPatch: SynthPatch = { ...DEFAULT_PATCH };

  initialize(config: Omit<SynthEngineConfig, 'audioContext' | 'destination'>): void {
    const ctx = this.audioCtx.getContext()!;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(ctx.destination);
    this.engine?.disconnect();
    this.engine = new SynthEngine({
      audioContext: ctx,
      destination: this.analyser,
      ...config
    });
  }

  getAnalyser(): AnalyserNode | undefined {
    return this.analyser;
  }

  getPatch(): Readonly<SynthPatch> {
    return this.currentPatch;
  }

  /**
   * Applies all engine-relevant fields from the patch to the running engine and
   * updates the tracked patch state. Arpeggiator fields are stored in the patch
   * but not forwarded to the engine (managed by ArpeggiatorPanel directly).
   */
  applyPatch(patch: SynthPatch): void {
    this.currentPatch = { ...patch };
    this.engine?.setParameters(synthPatchToEngineParameters(patch));
  }

  setParameters(params: SynthEngineParameters): void {
    this.engine?.setParameters(params);
    this.syncPatchFromParameters(params);
  }

  private syncPatchFromParameters(params: SynthEngineParameters): void {
    const p: Partial<SynthPatch> = {};

    if (params.oscillator1Type !== undefined) p.oscillator1Type = params.oscillator1Type;
    if (params.oscillator2Type !== undefined) p.oscillator2Type = params.oscillator2Type;
    if (params.oscillator1Amount !== undefined) p.oscillator1Amount = params.oscillator1Amount;
    if (params.oscillator2Amount !== undefined) p.oscillator2Amount = params.oscillator2Amount;
    if (params.oscillator2SubOctave !== undefined) p.oscillator2SubOctave = params.oscillator2SubOctave;
    if (params.oscillator2Invert !== undefined) p.oscillator2Invert = params.oscillator2Invert;
    if (params.glideTime !== undefined) p.glideTime = params.glideTime;

    if (params.filter?.enabled !== undefined) p.filterEnabled = params.filter.enabled;
    if (params.filter?.type !== undefined) p.filterType = params.filter.type;
    if (params.filter?.frequency !== undefined) p.filterFrequency = params.filter.frequency;
    if (params.filter?.Q !== undefined) p.filterQ = params.filter.Q;
    if (params.filter?.keyboardTracking !== undefined) p.filterKeyboardTracking = params.filter.keyboardTracking;
    if (params.filter?.postGain !== undefined) p.filterPostGain = params.filter.postGain;
    if (params.filter?.envelopeEnabled !== undefined) p.filterEnvelopeEnabled = params.filter.envelopeEnabled;
    if (params.filter?.envelopeAttack !== undefined) p.filterEnvelopeAttack = params.filter.envelopeAttack;
    if (params.filter?.envelopeDecay !== undefined) p.filterEnvelopeDecay = params.filter.envelopeDecay;
    if (params.filter?.envelopeSustain !== undefined) p.filterEnvelopeSustain = params.filter.envelopeSustain;
    if (params.filter?.envelopeRelease !== undefined) p.filterEnvelopeRelease = params.filter.envelopeRelease;

    if (params.envelope?.attack !== undefined) p.envelopeAttack = params.envelope.attack;
    if (params.envelope?.decay !== undefined) p.envelopeDecay = params.envelope.decay;
    if (params.envelope?.sustain !== undefined) p.envelopeSustain = params.envelope.sustain;
    if (params.envelope?.release !== undefined) p.envelopeRelease = params.envelope.release;

    if (params.overdrive?.enabled !== undefined) p.overdriveEnabled = params.overdrive.enabled;
    if (params.overdrive?.type !== undefined) p.overdriveType = params.overdrive.type;
    if (params.overdrive?.amount !== undefined) p.overdriveAmount = params.overdrive.amount;

    if (params.delay?.enabled !== undefined) p.delayEnabled = params.delay.enabled;
    if (params.delay?.delayTime !== undefined) p.delayTime = params.delay.delayTime;
    if (params.delay?.feedback !== undefined) p.delayFeedback = params.delay.feedback;
    if (params.delay?.mix !== undefined) p.delayMix = params.delay.mix;
    if (params.delay?.pingPong !== undefined) p.delayPingPong = params.delay.pingPong;
    if (params.delay?.delayPan !== undefined) p.delayPan = params.delay.delayPan;

    this.currentPatch = { ...this.currentPatch, ...p };
  }

  play(frequency: number): void {
    this.engine?.play(frequency);
  }

  setDetune(cents: number): void {
    this.engine?.setDetune(cents);
  }

  stop(): void {
    this.engine?.stop();
  }

  isPlaying(): boolean {
    return this.engine?.isPlaying() ?? false;
  }

  disconnect(): void {
    this.engine?.disconnect();
  }
}
