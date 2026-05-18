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
  private currentGain: number = 1;
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
      this.currentGain = Math.abs(params.gain ?? this.currentGain);
      this.gainNode.gain.setValueAtTime(this.invert ? -this.currentGain : this.currentGain, this.audioContext.currentTime);
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
      this.oscillatorNode.detune.setValueAtTime(cents, this.audioContext.currentTime);
    }
  }

  isPlaying(): boolean {
    return this.currentState === 'playing' || this.currentState === 'stopping';
  }

  getCurrentFrequency(): number | undefined {
    return this.currentFrequency;
  }

  getCurrentGain(): number {
    return this.currentGain;
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
//
// Eliminates the 'stopping' intermediate state by keeping the previously
// active oscillator in a dedicated "fading" slot while a new note starts.
//
// Each slot gets its own per-slot fader GainNode so that an evicted fading
// node can be ramped silently to zero (DISMISS_FADE = 5 ms) before it is
// stopped and disconnected. This prevents both hard-cut clicks and long
// frequency bleed when a new note starts during an ongoing release tail.
//
// Signal path:  activeNode → activeFader ──┐
//                                           ├──▶ gainNode ──▶ destination
//               fadingNode → fadingFader ──┘
//
// gainNode carries the overall gain / invert parameter.
// Per-fader gains are always 1 and are only automated during dismissal.
// ---------------------------------------------------------------------------

export class OscillatorController2 {
  private static readonly DISMISS_FADE = 0.001; // 5 ms

  private activeNode: OscillatorNode | null = null;
  private activeFader: GainNode | null = null;
  private fadingNode: OscillatorNode | null = null;
  private fadingFader: GainNode | null = null;
  private gainNode: GainNode;
  private glideTime = 0.0;
  private invert = false;
  private currentGain = 1;
  private isActive = false;
  private currentFrequency = 440;
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

  private spawnSlot(): { node: OscillatorNode; fader: GainNode } {
    const fader = this.audioContext.createGain();
    fader.connect(this.gainNode);

    const node = this.audioContext.createOscillator();
    node.type = this.oscillatorType;
    node.frequency.value = this.currentFrequency;
    node.connect(fader);

    return { node, fader };
  }

  // Ramps the fading slot's fader to 0 over `fadeTime` seconds (default:
  // DISMISS_FADE = 5 ms), then waits for the node to reach its
  // originally-scheduled stop naturally. This avoids calling stop() twice
  // (once when the node was retired, once here), which has inconsistent
  // effects across engines. The fader reaches 0 at t + fadeTime so there is
  // no audible contribution after that point.
  //
  // Use a shorter fadeTime when the fading node's effective gain is already
  // low (e.g. retrigger during release), so that the downstream envelope
  // attack cannot amplify the fading node faster than the dismiss ramp can
  // silence it.
  private dismissFading(at?: number, fadeTime = OscillatorController2.DISMISS_FADE): void {
    if (!this.fadingNode || !this.fadingFader) return;

    const node = this.fadingNode;
    const fader = this.fadingFader;

    // Clear class references immediately. The per-retirement closure on node
    // uses fadingNode === this.fadingNode as a guard and becomes a safe no-op.
    // A fresh cleanup listener below handles the eventual disconnection.
    this.fadingNode = null;
    this.fadingFader = null;

    const t = at ?? this.audioContext.currentTime;
    fader.gain.cancelScheduledValues(t);
    fader.gain.setValueAtTime(1, t);
    fader.gain.linearRampToValueAtTime(0, t + fadeTime);

    node.addEventListener(
      'ended',
      () => {
        safeDisconnect(node, fader);
        safeDisconnect(fader, this.gainNode);
      },
      { once: true, passive: true },
    );
  }

  // Moves the active slot to fading, evicting any existing fading node first
  // (rapid-retrigger case where a previous fade is still in progress).
  private retireToFading(at?: number): void {
    this.dismissFading(at);
    if (this.activeNode && this.activeFader) {
      // Capture node/fader in a per-retirement closure so the guard check is
      // independent of this.fadingNode being updated later (e.g. by another
      // dismissFading call). Using a unique closure per retirement avoids any
      // browser edge-cases with reusing the same function reference across
      // different nodes after a removeEventListener / addEventListener cycle.
      const fadingNode = this.activeNode;
      const fadingFader = this.activeFader;

      fadingNode.addEventListener(
        'ended',
        () => {
          if (fadingNode === this.fadingNode) {
            safeDisconnect(fadingNode, fadingFader);
            safeDisconnect(fadingFader, this.gainNode);
            this.fadingNode = null;
            this.fadingFader = null;
          }
        },
        { once: true, passive: true },
      );

      this.fadingNode = fadingNode;
      this.fadingFader = fadingFader;
      this.activeNode = null;
      this.activeFader = null;
    }
  }

  play(options: PlaybackOptions): void {
    const now = this.audioContext.currentTime;
    const { frequency, glideTime = this.glideTime, when, at } = options;
    const playTime = at ?? (when ? when + now : now);

    const prevFrequency = this.currentFrequency;
    this.currentFrequency = frequency;

    if (!this.isActive) {
      // Dismiss any fading node immediately so the old frequency does not bleed
      // into the new note's attack through the shared gainNode.
      // Use a 1 ms fade (vs the full DISMISS_FADE) here because the fading node
      // is envelope-releasing — its effective gain is already low. A shorter
      // dismiss prevents the downstream envelope attack from amplifying the
      // fading node faster than the fader ramp can silence it, which would
      // otherwise cause a transient bump (pop) at the retrigger point.
      this.dismissFading(playTime, 0.001);

      const { node, fader } = this.spawnSlot();
      this.activeNode = node;
      this.activeFader = fader;
      this.isActive = true;

      // 5 ms fade-in to avoid click on attack (mirrors the dismiss fade).
      fader.gain.setValueAtTime(0, playTime);
      fader.gain.linearRampToValueAtTime(1, playTime + OscillatorController2.DISMISS_FADE);

      this.activeNode.start(playTime);
    } else {
      // Legato frequency change on the already-running active node.
      this.activeNode!.frequency.cancelScheduledValues(playTime);
      if (glideTime > 0) {
        this.activeNode!.frequency.setValueAtTime(prevFrequency, playTime);
        this.activeNode!.frequency.linearRampToValueAtTime(frequency, playTime + glideTime);
      } else {
        this.activeNode!.frequency.setValueAtTime(frequency, playTime);
      }
    }
  }

  stop(releaseTime?: number, at?: number): void {
    if (this.activeNode === null) return;

    const now = this.audioContext.currentTime;
    const stopTime = at !== undefined ? at + (releaseTime ?? 0) : now + (releaseTime ?? 0);

    this.isActive = false;
    this.retireToFading(at);
    this.fadingNode?.stop(stopTime);
  }

  restart(options: Partial<PlaybackOptions>): void {
    const { frequency, at } = options;
    this.stop(0, at);
    this.play({ frequency: frequency ?? this.currentFrequency, at });
  }

  triggerPitchSweep(startHz: number, endHz: number, duration: number, at?: number): void {
    if (!this.activeNode) return;

    const t = at ?? this.audioContext.currentTime;
    const safeStart = Math.max(1, startHz);
    const safeEnd = Math.max(1, endHz);

    this.activeNode.frequency.cancelScheduledValues(t);
    this.activeNode.frequency.setValueAtTime(safeStart, t);
    this.activeNode.frequency.exponentialRampToValueAtTime(safeEnd, t + duration);
  }

  setParameters(params: OscillatorParameters): void {
    if (params.frequency !== undefined) {
      this.currentFrequency = params.frequency;
      if (this.isActive) this.play({ frequency: params.frequency });
    }

    if (params.gain !== undefined || params.invert !== undefined) {
      this.invert = params.invert ?? this.invert;
      this.currentGain = Math.abs(params.gain ?? this.currentGain);
      this.gainNode.gain.setValueAtTime(
        this.invert ? -this.currentGain : this.currentGain,
        this.audioContext.currentTime
      );
    }

    if (params.glideTime !== undefined) {
      this.glideTime = params.glideTime;
    }

    if (params.type !== undefined) {
      this.oscillatorType = params.type;
      if (this.activeNode) this.activeNode.type = params.type;
    }
  }

  setDetune(cents: number): void {
    if (this.activeNode) {
      this.activeNode.detune.setValueAtTime(cents, this.audioContext.currentTime);
    }
  }

  isPlaying(): boolean {
    return this.isActive || this.fadingNode !== null;
  }

  getCurrentFrequency(): number | undefined {
    return this.currentFrequency;
  }

  getCurrentGain(): number {
    return this.currentGain;
  }

  isInverted(): boolean {
    return this.invert;
  }

  disconnect(): void {
    if (this.activeNode) {
      this.activeNode.stop();
      safeDisconnect(this.activeNode, this.activeFader!);
      safeDisconnect(this.activeFader!, this.gainNode);
      this.activeNode = null;
      this.activeFader = null;
    }
    // Immediate teardown — no 5 ms fade on disconnect().
    if (this.fadingNode) {
      this.fadingNode.stop();
      safeDisconnect(this.fadingNode, this.fadingFader!);
      safeDisconnect(this.fadingFader!, this.gainNode);
      this.fadingNode = null;
      this.fadingFader = null;
    }
    safeDisconnect(this.gainNode, this.destination);
  }
}
