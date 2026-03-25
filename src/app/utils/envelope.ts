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

  trigger(): void {
    const currentGain = this.gainNode.gain.value;
    const now = this.audioContext.currentTime;
    const { attack, decay, enabled, sustain } = this;

    if (!enabled && currentGain === 1) return;

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.value = !enabled ? 1 : currentGain;

    if (enabled) {
      this.gainNode.gain.linearRampToValueAtTime(1, now + attack);
      this.gainNode.gain.linearRampToValueAtTime(
        sustain,
        now + attack + decay
      );
    }
  }

  release(): void {
    const currentGain = this.gainNode.gain.value;
    const now = this.audioContext.currentTime;
    const { enabled, releaseTime } = this;

    if (!enabled && currentGain === 0) return;

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.value = !enabled ? 0 : currentGain;

    if (enabled) {
      this.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
    }
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
