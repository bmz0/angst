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
}

export class OscillatorController {
  private oscillator?: OscillatorNode;
  private currentFrequency?: number;
  private readonly audioContext: AudioContext;
  private readonly destination: AudioNode;
  private oscillatorType: OscillatorType = 'sine';

  private readonly defaultGlideTime = 0.1;

  constructor(config: OscillatorConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;
    this.oscillatorType = config.type;
  }

  play(options: PlaybackOptions): void {
    const now = this.audioContext.currentTime;
    const { frequency, glideTime = this.defaultGlideTime } = options;

    if (!this.oscillator) {
      this.createOscillator(frequency);
    } else if (this.currentFrequency !== frequency) {
      this.oscillator.frequency.linearRampToValueAtTime(frequency, now + glideTime);
    }

    this.currentFrequency = frequency;
  }

  stop(): void {
    if (!this.oscillator) return;

    this.oscillator.stop();
    this.oscillator.disconnect();
    this.oscillator = undefined;
    this.currentFrequency = undefined;
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
    this.stop();
  }

  private createOscillator(frequency: number): void {
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = this.oscillatorType;
    this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    this.oscillator.connect(this.destination);
    this.oscillator.start();
  }
}
