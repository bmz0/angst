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
    const { frequency, glideTime = this.glideTime, when } = options;
    const playTime = when ? when + now : now;

    this.currentFrequency = frequency;

    switch (this.currentState) {
      //@ts-expect-error - early dispose oscillator if still stopping
      case 'stopping':
        if (this.oscillatorNode) this.disposeOscillator();
        this.currentState = 'stopped';
      //@ts-expect-error - continue playing immediately
      case 'stopped':
        this.createOscillatorNode();
        this.oscillatorNode!.start(playTime);
        this.currentState = 'playing';
     case 'playing':
        this.oscillatorNode!.frequency.linearRampToValueAtTime(frequency, playTime + glideTime);
        break;
    }
  }
  
  async stop(when?: number) {
    const now = this.audioContext.currentTime;
    const stopTime = when ? now + when : now;
    const currentOscillator = this.oscillatorNode;

    this.currentState = 'stopping';

    if (currentOscillator) {
      const oscEnded = new Promise<void>((resolve) => {
        if (currentOscillator) {
          currentOscillator.addEventListener('ended', () => resolve(), { once: true, passive: true });
        } else {
          resolve();
        }
      });
      currentOscillator!.stop(stopTime);
      await oscEnded;
      currentOscillator.disconnect(this.gainNode);
      if (this.oscillatorNode === currentOscillator) this.oscillatorNode = null;
    }

    this.currentState = 'stopped';
  }

  restart(options: PlaybackOptions): void {
    const { frequency, when } = options;
    const now = this.audioContext.currentTime;
    const restartTime = when ? when + now : now;
    this.stop(now).then(() => {
      this.play({ frequency: frequency ?? this.currentFrequency, when: restartTime });
    });
  }

  disposeOscillator(): void {
    if (this.oscillatorNode) {
      this.oscillatorNode.disconnect(this.gainNode);
      this.oscillatorNode = null;
    }
  }

  setParameters(params: OscillatorParameters): void {
    const now = this.audioContext.currentTime;
    
    if (params.frequency !== undefined) {
      this.currentFrequency = params.frequency;
      if (this.currentState === 'playing') this.play({ frequency: params.frequency });
    }

    if (params.gain !== undefined || params.invert !== undefined) {
      this.invert = params.invert ?? this.invert;
      const gain = Math.abs(params.gain ?? this.gainNode.gain.value);
      this.gainNode.gain.setValueAtTime(this.invert ? -gain : gain, now);
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
