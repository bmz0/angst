import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioContextService {
  private readonly context = signal<AudioContext | undefined>(undefined);

  initialize(): void {
    if (!this.context()) {
      const ctx = new AudioContext();
      this.context.set(ctx);
    }
  }

  getContext(): AudioContext | undefined {
    return this.context();
  }

  resume(): void {
    const ctx = this.context();
    if (ctx?.state === 'suspended') {
      ctx.resume();
    }
  }

  get state(): AudioContextState | undefined {
    return this.context()?.state;
  }
}
