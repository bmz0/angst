import { safeDisconnect } from './common.js';

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export type OscillatorConfig = {
  audioContext: BaseAudioContext;
  destination: AudioNode;
} & OscillatorParameters;

export interface PlaybackOptions {
  frequency: number;
  glideTime?: number;
  when?: number;
  /** Absolute AudioContext time at which to start playback (offline-scheduler use). */
  at?: number;
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
    const { frequency, glideTime = this.glideTime, when, at } = options;
    const playTime = at ?? (when ? when + now : now);

    const prevFrequency = this.currentFrequency;
    this.currentFrequency = frequency;

    switch (this.currentState) {
      //@ts-expect-error - early dispose oscillator if still stopping
      case 'stopping':
        if (at !== undefined) {
          // Offline mode: the old oscillator has a scheduled stop in the
          // audio timeline already; leave it connected and just orphan the
          // reference so stopCallback doesn't confuse the new node.
          this.oscillatorNode = null;
        } else {
          this.disposeOscillator();
        }
        this.currentState = 'stopped';
      case 'init':
      case 'stopped':
        // createOscillatorNode already sets frequency.value to the target — no ramp needed.
        this.createOscillatorNode();
        this.currentState = 'playing';
        this.oscillatorNode!.start(playTime);
        break;
      case 'playing':
        // Cancel any previously-scheduled frequency automation at or after playTime to
        // prevent accidental pitch glide between notes when glideTime is 0. Without this,
        // linearRampToValueAtTime would interpolate from the previous note's pitch over the
        // entire step duration even with glideTime = 0.
        this.oscillatorNode!.frequency.cancelScheduledValues(playTime);
        if (glideTime > 0) {
          this.oscillatorNode!.frequency.setValueAtTime(prevFrequency, playTime);
          this.oscillatorNode!.frequency.linearRampToValueAtTime(frequency, playTime + glideTime);
        } else {
          this.oscillatorNode!.frequency.setValueAtTime(frequency, playTime);
        }
        break;
    }
  }
  
  stop(releaseTime?: number, at?: number) {
    if (!this.isPlaying()) return;
      
    const now = this.audioContext.currentTime;
    const stopTime = at !== undefined ? at + (releaseTime ?? 0) : now + (releaseTime ?? 0);
    const currentOscillator = this.oscillatorNode;

    this.currentState = 'stopping';

    if (currentOscillator) {
      currentOscillator.addEventListener('ended', this.stopCallback, { once: true, passive: true })
      currentOscillator.stop(stopTime);
    }
  }

  protected stopCallback = (event: Event) => {
    if ((event.target as OscillatorNode) === this.oscillatorNode) {
      this.disposeOscillator();
      this.currentState = 'stopped';
    }
  }

  restart(options: Partial<PlaybackOptions>): void {
    const { frequency, at } = options;
    this.stop(0, at);
    this.play({ frequency: frequency ?? this.currentFrequency, at });
  }

  /**
   * Schedules an exponential frequency sweep on the currently playing oscillator.
   * Intended for percussive pitch drops (e.g. kick drum) where the pitch falls
   * from `startHz` to `endHz` over `duration` seconds.
   *
   * Silently no-ops if the oscillator is not currently playing. Cancels any
   * previously scheduled frequency automation at `t` before applying the ramp,
   * so it is safe to call immediately after `play()` without glide interference.
   *
   * Both `startHz` and `endHz` are clamped to a minimum of 1 Hz — the Web Audio
   * `exponentialRampToValueAtTime` API requires strictly positive values.
   *
   * @param startHz  Frequency at the start of the sweep.
   * @param endHz    Frequency at the end of the sweep (the settled value).
   * @param duration Length of the sweep in seconds.
   * @param at       Absolute AudioContext time to begin the sweep (offline use).
   *                 Defaults to `audioContext.currentTime`.
   */
  triggerPitchSweep(startHz: number, endHz: number, duration: number, at?: number): void {
    if (!this.oscillatorNode) return;

    const t = at ?? this.audioContext.currentTime;
    const safeStart = Math.max(1, startHz);
    const safeEnd = Math.max(1, endHz);

    this.oscillatorNode.frequency.cancelScheduledValues(t);
    this.oscillatorNode.frequency.setValueAtTime(safeStart, t);
    this.oscillatorNode.frequency.exponentialRampToValueAtTime(safeEnd, t + duration);
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
      if (this.oscillatorNode) this.oscillatorNode.type = params.type;
    }
  }

  setDetune(cents: number): void {
    if (this.oscillatorNode) {
      this.oscillatorNode.detune.value = cents;
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
    if (this.isPlaying() && this.oscillatorNode) {
      this.oscillatorNode.stop();
      safeDisconnect(this.oscillatorNode, this.gainNode);
    }
    safeDisconnect(this.gainNode, this.destination);
  }
}
