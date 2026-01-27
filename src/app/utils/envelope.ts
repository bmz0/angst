export interface EnvelopeConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export interface EnvelopeParams {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export class EnvelopeController {
  private gainNode: GainNode;
  private readonly audioContext: AudioContext;
  private releaseTimeout?: number;
  private isActive = false;

  private attackTime: number;
  private decayTime: number;
  private sustainLevel: number;
  private releaseTime: number;

  constructor(config: EnvelopeConfig) {
    this.audioContext = config.audioContext;
    this.attackTime = config.attack ?? 0.005;
    this.decayTime = config.decay ?? 0.1;
    this.sustainLevel = config.sustain ?? 0.7;
    this.releaseTime = config.release ?? 0.005;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.gainNode.connect(config.destination);
  }

  getInput(): GainNode {
    return this.gainNode;
  }

  trigger(): void {
    if (this.releaseTimeout) {
      clearTimeout(this.releaseTimeout);
      this.releaseTimeout = undefined;
    }

    const now = this.audioContext.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);

    // Attack phase: ramp to peak (1.0)
    this.gainNode.gain.linearRampToValueAtTime(1.0, now + this.attackTime);

    // Decay phase: ramp down to sustain level
    this.gainNode.gain.linearRampToValueAtTime(
      this.sustainLevel,
      now + this.attackTime + this.decayTime
    );

    this.isActive = true;
  }

  release(): void {
    if (!this.isActive) return;

    const now = this.audioContext.currentTime;
    const valueNow = this.gainNode.gain.value;

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(valueNow, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + this.releaseTime);

    this.releaseTimeout = window.setTimeout(() => {
      this.isActive = false;
      this.releaseTimeout = undefined;
    }, this.releaseTime * 1000);
  }

  setParams(params: EnvelopeParams): void {
    if (params.attack !== undefined) this.attackTime = params.attack;
    if (params.decay !== undefined) this.decayTime = params.decay;
    if (params.sustain !== undefined) this.sustainLevel = params.sustain;
    if (params.release !== undefined) this.releaseTime = params.release;
  }

  setAttack(attack: number): void {
    this.attackTime = attack;
  }

  setDecay(decay: number): void {
    this.decayTime = decay;
  }

  setSustain(sustain: number): void {
    this.sustainLevel = sustain;
  }

  setRelease(release: number): void {
    this.releaseTime = release;
  }

  getParams(): Required<EnvelopeParams> {
    return {
      attack: this.attackTime,
      decay: this.decayTime,
      sustain: this.sustainLevel,
      release: this.releaseTime
    };
  }

  disconnect(): void {
    if (this.releaseTimeout) {
      clearTimeout(this.releaseTimeout);
    }
    this.gainNode.disconnect();
  }

  isTriggered(): boolean {
    return this.isActive;
  }
}
