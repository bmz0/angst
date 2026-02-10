export interface EnvelopeConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface EnvelopeParameters {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export class EnvelopeController {
  private gainNode: GainNode;
  private readonly audioContext: AudioContext;
  private attack: number;
  private decay: number;
  private sustain: number;
  private releaseTime: number;

  constructor(config: EnvelopeConfig) {
    this.audioContext = config.audioContext;
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

  setParameters(params: EnvelopeParameters): void {
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

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(currentGain, now);
    this.gainNode.gain.linearRampToValueAtTime(1, now + this.attack);
    this.gainNode.gain.linearRampToValueAtTime(
      this.sustain,
      now + this.attack + this.decay
    );
  }

  release(): void {
    const currentGain = this.gainNode.gain.value;
    const now = this.audioContext.currentTime;

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(currentGain, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + this.releaseTime);
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
