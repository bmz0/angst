import { Injectable, inject } from '@angular/core';
import { AudioContextService } from './audio-context.service.js';
import { SynthEngine, SynthEngineConfig, SynthEngineParameters } from '../synth/synthEngine.js';

@Injectable({ providedIn: 'root' })
export class SynthEngineService {
  private engine?: SynthEngine;
  private readonly audioCtx = inject(AudioContextService);

  initialize(config: Omit<SynthEngineConfig, 'audioContext'>): void {
    this.engine?.disconnect();
    this.engine = new SynthEngine({
      audioContext: this.audioCtx.getContext()!,
      ...config
    });
  }

  setParameters(params: SynthEngineParameters): void {
    this.engine?.setParameters(params);
  }

  play(frequency: number): void {
    this.engine?.play(frequency);
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
