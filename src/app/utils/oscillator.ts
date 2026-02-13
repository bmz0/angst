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
  when?: number;
}

export type PlayState = 'init' | 'playing' | 'stopping' | 'stopped';

export class OscillatorController {
  private oscillatorNode: OscillatorNode | null = null;
  private gainNode: GainNode;
  private currentState: PlayState = 'init';
  private currentFrequency: number = 440;
  private readonly audioContext: AudioContext;
  private readonly destination: AudioNode;
  private oscillatorType: OscillatorType = 'sine';

  private readonly defaultGlideTime = 0.0;

  constructor(config: OscillatorConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;
    this.oscillatorType = config.type;

    this.gainNode = this.audioContext.createGain();

    this.createOscillatorNode();
    this.gainNode.connect(this.destination);
  }

  createOscillatorNode(): void {
    this.oscillatorNode = this.audioContext.createOscillator();
    this.oscillatorNode.type = this.oscillatorType;

    this.oscillatorNode.frequency.value = this.currentFrequency;

    this.oscillatorNode.connect(this.gainNode);
  }

  play(options: PlaybackOptions): void {
    const now = this.audioContext.currentTime;
    const { frequency, glideTime = this.defaultGlideTime, when = now } = options;
    
    this.currentFrequency = frequency;

    switch (this.currentState) {
      case 'init':
      case 'stopped':
        this.createOscillatorNode();
        this.oscillatorNode!.start(when);
        this.currentState = 'playing';
        break;
      case 'stopping':
        this.disposeOscillator();
        this.currentState = 'stopped';
        this.play({ frequency, glideTime, when });
        break
     case 'playing':
        this.oscillatorNode!.frequency.linearRampToValueAtTime(frequency, when + glideTime);
        break;
    }
  }
  
  async stop(when?: number) {
    const now = this.audioContext.currentTime;
    const oscEnded = new Promise<void>((resolve) => {
      if (this.oscillatorNode) {
        this.oscillatorNode.addEventListener('ended', () => resolve(), { once: true, passive: true });
      } else {
        resolve();
      }
    });
    
    this.currentState = 'stopping';
    this.oscillatorNode!.stop(when ?? now);
    await oscEnded;
    this.disposeOscillator();
  }

  stopCallback = () => {
    this.disposeOscillator();
  }

  restart(options: PlaybackOptions): void {
    const { frequency , when } = options;
    const now = this.audioContext.currentTime;
    this.stop().then(() => {
      this.play({ frequency: frequency ?? this.currentFrequency, when: when ?? now });
    });
  }

  disposeOscillator(): void {
    this.oscillatorNode!.disconnect(this.gainNode);
    this.currentState = 'stopped';
    this.oscillatorNode = null;
  }

  setType(type: OscillatorType): void {
    this.oscillatorType = type;
    this.oscillatorNode!.type = type;
  }

  getType(): OscillatorType {
    return this.oscillatorType;
  }

  isPlaying(): boolean {
    return this.currentState === 'playing' || this.currentState === 'stopping';
  }

  getCurrentFrequency(): number | undefined {
    return this.currentFrequency;
  }

  disconnect(): void {
    this.oscillatorNode!.stop();
    this.disposeOscillator();
  }
}
