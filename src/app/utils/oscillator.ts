export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export type OscillatorConfig = {
  audioContext: BaseAudioContext;
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

export type PlayState = 'init' | 'stopped' | 'playing' | 'stopping';

export class OscillatorController {
  private oscillatorNode: OscillatorNode | null = null;
  private gainNode: GainNode;
  private glideTime = 0.0;
  private invert: boolean = false;
  private currentState: PlayState = 'init';
  private currentFrequency: number = 440;
  private readonly audioContext: BaseAudioContext;
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
        this.disposeOscillator();
        this.currentState = 'stopped';
      case 'init':
      //@ts-expect-error - continue playing immediately
      case 'stopped':
        this.createOscillatorNode();
        this.currentState = 'playing';
        this.oscillatorNode!.start(playTime);
     case 'playing':
        this.oscillatorNode!.frequency.linearRampToValueAtTime(frequency, playTime + glideTime);
        break;
    }
  }
  
  stop(when?: number) {
    if (!this.isPlaying()) return;
      
    const now = this.audioContext.currentTime;
    const stopTime = when ? now + when : now;
    const currentOscillator = this.oscillatorNode;

    this.currentState = 'stopping';

    if (currentOscillator) {
      currentOscillator.addEventListener('ended', this.stopCallback, { once: true, passive: true })
      currentOscillator.stop(stopTime);
    }
  }

  protected stopCallback = (event: Event) => {
    if (event.target as OscillatorNode === this.oscillatorNode) {
      this.disposeOscillator();
      this.currentState = 'stopped';
    }
  }

  restart(options: Partial<PlaybackOptions>): void {
    const { frequency } = options;
    this.stop();
    this.play({ frequency: frequency ?? this.currentFrequency });
  }

  disposeOscillator(): void {
    if (this.oscillatorNode) {
      this.oscillatorNode.disconnect(this.gainNode);
      this.oscillatorNode = null;
    }
  }

  setParameters(params: OscillatorParameters): void {
    if (params.frequency !== undefined) {
      this.currentFrequency = params.frequency;
      if (this.currentState === 'playing') this.play({ frequency: params.frequency });
    }

    if (params.gain !== undefined || params.invert !== undefined) {
      this.invert = params.invert ?? this.invert;
      const gain = Math.abs(params.gain ?? this.gainNode.gain.value);
      this.gainNode.gain.value = this.invert ? -gain : gain;
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
    return this.currentState === 'playing' || this.currentState === 'stopping';
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
    if (this.isPlaying()) {
      this.oscillatorNode?.stop();
    }
    try {
      this.gainNode.disconnect(this.destination);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidAccessError') {
        // Ignore error if already disconnected
      } else {
        throw error;
      }
    }
  }
}
