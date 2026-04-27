export interface EnvelopeConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  enabled?: boolean;
}

export interface EnvelopeParameters {
  enabled?: boolean;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export class EnvelopeController {
  private gainNode: GainNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private attack: number;
  private decay: number;
  private sustain: number;
  private releaseTime: number;

  // Tracks the gain level that will be in effect at the end of the last
  // scheduled event. Used in offline mode where gainNode.gain.value
  // never reflects scheduled automation.
  private scheduledGain: number = 0;

  constructor(config: EnvelopeConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled ?? true;
    this.attack = config.attack;
    this.decay = config.decay;
    this.sustain = config.sustain;
    this.releaseTime = config.release;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(config.destination);
  }

  getInput(): GainNode {
    return this.gainNode;
  }

  getEnabled(): boolean {
    return this.enabled;
  }

  setParameters(params: EnvelopeParameters): void {
    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
    }
    if (params.attack !== undefined) {
      this.attack = params.attack;
    }
    if (params.decay !== undefined) {
      this.decay = params.decay;
    }
    if (params.sustain !== undefined) {
      this.sustain = params.sustain;
    }
    if (params.release !== undefined) {
      this.releaseTime = params.release;
    }
  }

  trigger(at?: number): void {
    const now = this.audioContext.currentTime;
    const t = at ?? now;
    const { attack, decay, enabled, sustain } = this;

    // In live mode only, skip no-op re-trigger of an already-full (non-enveloped) gain
    if (at === undefined && !enabled && this.gainNode.gain.value === 1) return;

    // Starting value: in offline mode use the tracked scheduled level;
    // in live mode read the actual current gain.
    const startGain = at !== undefined ? this.scheduledGain
                                       : this.gainNode.gain.value;

    // Cancel future automation in both live and offline modes. In offline mode,
    // stale release ramps from previous notes bleed into the new note's attack
    // and cut it off early, making the recording sound faster than the tempo.
    this.gainNode.gain.cancelScheduledValues(t);

    const initValue = !enabled ? 1 : startGain;
    if (at !== undefined) {
      // Offline mode: must schedule so the audio timeline reflects the value.
      this.gainNode.gain.setValueAtTime(initValue, t);
    } else {
      // Live mode: set .value directly so it is immediately readable by callers.
      this.gainNode.gain.value = initValue;
    }

    if (enabled) {
      this.gainNode.gain.linearRampToValueAtTime(1, t + attack);
      this.gainNode.gain.linearRampToValueAtTime(sustain, t + attack + decay);
      this.scheduledGain = sustain;
    } else {
      this.scheduledGain = 1;
    }
  }

  release(at?: number): void {
    const now = this.audioContext.currentTime;
    const t = at ?? now;
    const { enabled, releaseTime } = this;

    // In live mode only, skip no-op release of an already-silent (non-enveloped) gain
    if (at === undefined && !enabled && this.gainNode.gain.value === 0) return;

    // Starting value: in offline mode use the tracked scheduled level.
    const startGain = at !== undefined ? this.scheduledGain
                                       : this.gainNode.gain.value;

    // Cancel future automation in both live and offline modes (e.g. a long attack
    // scheduled beyond the note-off time must be removed before the release ramp).
    this.gainNode.gain.cancelScheduledValues(t);

    const initValue = !enabled ? 0 : startGain;
    if (at !== undefined) {
      // Offline mode: must schedule so the audio timeline reflects the value.
      this.gainNode.gain.setValueAtTime(initValue, t);
    } else {
      // Live mode: set .value directly so it is immediately readable by callers.
      this.gainNode.gain.value = initValue;
    }

    if (enabled) {
      this.gainNode.gain.linearRampToValueAtTime(0, t + releaseTime);
    }
    this.scheduledGain = 0;
  }

  getParams(): { attack: number; decay: number; sustain: number; release: number } {
    return {
      attack: this.attack,
      decay: this.decay,
      sustain: this.sustain,
      release: this.releaseTime
    };
  }

  disconnect(): void {
    this.gainNode.disconnect();
  }
}
