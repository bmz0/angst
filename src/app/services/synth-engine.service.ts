import { Injectable, inject } from '@angular/core';
import { AudioContextService } from './audio-context.service.js';
import { SynthEngine, SynthEngineConfig, SynthEngineParameters } from '../synth/synthEngine.js';

@Injectable({ providedIn: 'root' })
export class SynthEngineService {
  private engine?: SynthEngine;
  private analyser?: AnalyserNode;
  private readonly audioCtx = inject(AudioContextService);

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

  setParameters(params: SynthEngineParameters): void {
    this.engine?.setParameters(params);
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
