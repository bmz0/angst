import { Injectable, inject } from '@angular/core';
import { AudioContextService } from './audio-context.service.js';
import { SynthEngine, SynthEngineConfig, SynthEngineParameters } from '../synth/synthEngine.js';
import {
  DEFAULT_PATCH,
  SynthPatch,
  mergePatchWithParams,
  synthPatchToEngineConfig,
  synthPatchToEngineParameters,
} from '../synth/synth-patch.js';

@Injectable({ providedIn: 'root' })
export class SynthEngineService {
  private engine?: SynthEngine;
  private analyser?: AnalyserNode;
  private readonly audioCtx = inject(AudioContextService);
  private currentPatch: SynthPatch = { ...DEFAULT_PATCH };

  async initialize(config: Omit<SynthEngineConfig, 'audioContext' | 'destination'>): Promise<void> {
    const ctx = this.audioCtx.getContext()!;
    await SynthEngine.preload(ctx);
    this.analyser?.disconnect();
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
    this.currentPatch = mergePatchWithParams(this.currentPatch, params);
  }

  /**
   * Updates arpeggiator-only patch fields without touching engine parameters.
   * Called by ArpeggiatorPanel so its state is persisted back into the patch.
   */
  updateArpeggiatorPatch(
    partial: Pick<SynthPatch, 'arpeggiatorEnabled' | 'arpeggiatorTempo' | 'arpeggiatorPattern'>,
  ): void {
    this.currentPatch = { ...this.currentPatch, ...partial };
  }

  play(frequency: number): void {
    this.engine?.play(frequency);
  }

  playNote(noteId: number, frequency: number): void {
    this.engine?.playNote(noteId, frequency);
  }

  private pitchBendCents = 0;
  private arpDetuneCents = 0;

  /** Sets the detune contribution from the arpeggiator (in cents). */
  setArpDetune(cents: number): void {
    this.arpDetuneCents = cents;
    this.engine?.setDetune(this.pitchBendCents + this.arpDetuneCents);
  }

  /** Sets the detune contribution from MIDI pitch bend (in cents). */
  setPitchBendDetune(cents: number): void {
    this.pitchBendCents = cents;
    this.engine?.setDetune(this.pitchBendCents + this.arpDetuneCents);
  }

  stop(): void {
    this.engine?.stop();
  }

  stopNote(noteId: number): void {
    this.engine?.stopNote(noteId);
  }

  isPlaying(): boolean {
    return this.engine?.isPlaying() ?? false;
  }

  getLfoElapsedTime(index: number): number {
    return this.engine?.getLfoElapsedTime(index) ?? 0;
  }

  disconnect(): void {
    this.engine?.disconnect();
  }
}
