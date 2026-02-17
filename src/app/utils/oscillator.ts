export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export type OscillatorConfig = {
  audioContext: AudioContext;
  destination: AudioNode;
} & OscillatorParameters;

export interface PlaybackOptions {
  frequency: number;
  glideTime?: number;
  when?: number;
}

export interface OscillatorParameters {
  frequency?: number;
  gain?: number;
  glideTime?: number;
  invert?: boolean;
  type?: OscillatorType;
}

export type PlayState = 'stopped' | 'playing' | 'stopping';

export class OscillatorController {
  private oscillatorNode: OscillatorNode | null = null;
  private gainNode: GainNode;
  private glideTime = 0.0;
  private invert: boolean = false;
  private currentState: PlayState = 'stopped';
  private currentFrequency: number = 440;
  private readonly audioContext: AudioContext;
  private readonly destination: AudioNode;
  private oscillatorType: OscillatorType = 'sine';

  constructor(config: OscillatorConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;
    
    this.gainNode = this.audioContext.createGain();    
    this.createOscillatorNode();

    this.setParameters(config);

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
    const { frequency, glideTime = this.glideTime, when = now } = options;
    
    this.currentFrequency = frequency;

    switch (this.currentState) {
      //@ts-expect-error - early dispose oscillator if still stopping
      case 'stopping':
        this.disposeOscillator();
      case 'stopped':
        this.createOscillatorNode();
        this.oscillatorNode!.start(when);
        this.currentState = 'playing';
        break;
     case 'playing':
        this.oscillatorNode!.frequency.linearRampToValueAtTime(frequency, when + glideTime);
        break;
    }
  }
  
  async stop(when?: number) {
    const now = this.audioContext.currentTime;

    if (this.oscillatorNode) {
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
    }

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

  setParameters(params: OscillatorParameters): void {
    const now = this.audioContext.currentTime;
    
    if (params.frequency !== undefined) {
      this.currentFrequency = params.frequency;
      if (this.currentState === 'playing') this.play({ frequency: params.frequency });
    }

    if (params.gain !== undefined || params.invert !== undefined) {
      this.invert = params.invert ?? this.invert;
      const gain = params.gain ?? Math.abs(this.gainNode.gain.value);
      this.gainNode.gain.setValueAtTime(this.invert ? -Math.abs(gain) : Math.abs(gain), now);
    }
    
    if (params.glideTime !== undefined) {
      this.glideTime = params.glideTime;
    }

    if (params.type !== undefined) {
      this.oscillatorType = params.type;
      this.oscillatorNode!.type = params.type;
    }
  }

  isPlaying(): boolean {
    return this.currentState !== 'stopped';
  }

  getCurrentFrequency(): number | undefined {
    return this.currentFrequency;
  }

  getCurrentGain(): number {
    return Math.abs(this.gainNode.gain.value);
  }

  isInverted(): boolean {
    return this.invert;
  }

  disconnect(): void {
    this.oscillatorNode!.stop();
    this.disposeOscillator();
  }
}
