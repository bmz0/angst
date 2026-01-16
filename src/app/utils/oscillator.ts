export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface OscillatorConfig {
  audioContext: AudioContext;
  type: OscillatorType;
  frequency: number;
  destination: AudioNode;
}

export interface PlaybackOptions {
  frequency: number;
  glideTime?: number;
  attackTime?: number;
}

export class OscillatorController {
  private oscillator?: OscillatorNode;
  private gainNode: GainNode;
  private currentFrequency?: number;
  private readonly audioContext: AudioContext;
  private readonly destination: AudioNode;
  private oscillatorType: OscillatorType = 'sine';

  private readonly defaultAttackTime = 0.005;
  private readonly defaultReleaseTime = 0.005;
  private readonly defaultGlideTime = 0.1;

  constructor(config: OscillatorConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;
    this.oscillatorType = config.type;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.gainNode.connect(this.destination);
  }

  play(options: PlaybackOptions): void {
    const now = this.audioContext.currentTime;
    const { frequency, glideTime = this.defaultGlideTime, attackTime = this.defaultAttackTime } = options;

    if (!this.oscillator) {
      this.createOscillator(frequency);
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(1, now + attackTime);
    } else if (this.currentFrequency !== frequency) {
      this.oscillator.frequency.linearRampToValueAtTime(frequency, now + glideTime);
    }

    this.currentFrequency = frequency;
  }

  stop(releaseTime: number = this.defaultReleaseTime): void {
    if (!this.oscillator) return;

    const now = this.audioContext.currentTime;
    this.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

    setTimeout(() => {
      this.oscillator?.stop();
      this.oscillator?.disconnect();
      this.oscillator = undefined;
      this.currentFrequency = undefined;
    }, releaseTime * 1000);
  }

  setType(type: OscillatorType): void {
    this.oscillatorType = type;
    if (this.oscillator) {
      this.oscillator.type = type;
    }
  }

  getType(): OscillatorType {
    return this.oscillatorType;
  }

  isPlaying(): boolean {
    return this.oscillator !== undefined;
  }

  getCurrentFrequency(): number | undefined {
    return this.currentFrequency;
  }

  disconnect(): void {
    this.stop(0);
    this.gainNode.disconnect();
  }

  private createOscillator(frequency: number): void {
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = this.oscillatorType;
    this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
  }
}