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
  private oscillatorNode: OscillatorNode;
  private gainNode: GainNode;
  private currentFrequency?: number;
  private readonly audioContext: AudioContext;
  private readonly destination: AudioNode;
  private oscillatorType: OscillatorType = 'sine';

  private readonly defaultGlideTime = 0.0;

  constructor(config: OscillatorConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;
    this.oscillatorType = config.type;

    this.oscillatorNode = this.audioContext.createOscillator();
    this.oscillatorNode.type = config.type;
    this.oscillatorNode.frequency.value = config.frequency;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0; // Silent until played

    this.oscillatorNode.connect(this.gainNode);
    this.gainNode.connect(config.destination);
    this.oscillatorNode.start(); // Start immediately, control via gain
  }

  play(options: PlaybackOptions): void {
    const now = this.audioContext.currentTime;
    const { frequency, glideTime = this.defaultGlideTime } = options;

    // Just modulate frequency, oscillator keeps running
    this.oscillatorNode.frequency.linearRampToValueAtTime(frequency, now + glideTime);
    this.gainNode.gain.setValueAtTime(1, now);

    this.currentFrequency = frequency;
  }

  stop(): void {
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
  }

  setType(type: OscillatorType): void {
    this.oscillatorType = type;
    this.oscillatorNode.type = type;
  }

  getType(): OscillatorType {
    return this.oscillatorType;
  }

  isPlaying(): boolean {
    return this.gainNode.gain.value > 0;
  }

  getCurrentFrequency(): number | undefined {
    return this.currentFrequency;
  }

  disconnect(): void {
    this.stop();
  }
}
