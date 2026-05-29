import { OscillatorType } from './oscillator.js';

export type LfoTarget =
  | 'filterFrequency'
  | 'filterQ'
  | 'ladderFilterFrequency'
  | 'ladderFilterResonance'
  | 'delayMix'
  | 'reverbMix'
  | 'oscMix'
  | 'oscPreGain'
  | 'oscPostGain'
  | 'oscPitch'
  | 'lfo1Rate'
  | 'lfo1Depth'
  | 'lfo2Rate'
  | 'lfo2Depth';

export interface LfoParameters {
  enabled?: boolean;
  target?: LfoTarget;
  rate?: number;
  depth?: number;
  shape?: OscillatorType;
  retrigger?: boolean;
  /** Duration in seconds (0–2) over which the LFO rate ramps from 0 to the target rate.  0 = no fade. */
  fadeIn?: number;
}

/**
 * LfoController — a free-running LFO built from a single OscillatorNode feeding
 * a depth GainNode.  The depth GainNode is connected once to target AudioParams
 * or fan-out inputs; it stays connected across retriggers (only the OscillatorNode
 * is recreated on phase-reset).
 *
 * Rate and depth can be modulated by external sources (e.g., other LFOs) by
 * connecting to the rateParam and depthParam AudioParams respectively.
 *
 * Enable/disable is managed externally (SynthEngine) by connecting and disconnecting
 * from target AudioParams, so the oscillator itself is always running once started,
 * keeping Web Audio graph transitions glitch-free.
 */
export class LfoController {
  private readonly audioContext: BaseAudioContext;
  private readonly depthGain: GainNode;
  private readonly rateGain: GainNode;
  private readonly rateSource: ConstantSourceNode;
  private oscillatorNode: OscillatorNode | null = null;
  private shape: OscillatorType;
  private oscillatorStartTime = 0;
  private rateTarget = 2;
  private fadeInDuration = 0;

  constructor(
    audioContext: BaseAudioContext,
    rate = 2,
    depth = 0,
    shape: OscillatorType = 'sine',
  ) {
    this.audioContext = audioContext;
    this.shape = shape;
    this.rateTarget = rate;

    // Create a constant source feeding the rate gain for stable rate modulation
    this.rateSource = this.audioContext.createConstantSource();
    this.rateSource.offset.value = 1.0;
    
    this.rateGain = this.audioContext.createGain();
    this.rateGain.gain.value = rate;
    this.rateSource.connect(this.rateGain);
    this.rateSource.start();

    this.depthGain = this.audioContext.createGain();
    this.depthGain.gain.value = depth;

    this.startOscillator();
  }

  /** Phase-reset the LFO.  The depth GainNode stays connected to all targets. */
  retrigger(): void {
    if (this.oscillatorNode) {
      try { this.oscillatorNode.stop(); } catch { /* already stopped */ }
      this.oscillatorNode.disconnect(this.depthGain);
      try { this.rateGain.disconnect(this.oscillatorNode.frequency); } catch { /* not connected */ }
      this.oscillatorNode = null;
    }
    this.startOscillator();
    if (this.fadeInDuration > 0) {
      const now = this.audioContext.currentTime;
      this.rateGain.gain.cancelScheduledValues(now);
      this.rateGain.gain.setValueAtTime(0, now);
      this.rateGain.gain.linearRampToValueAtTime(this.rateTarget, now + this.fadeInDuration);
    }
  }

  setRate(hz: number): void {
    this.rateTarget = hz;
    // Cancel any in-progress fade-in ramp so live knob changes are immediate.
    const now = this.audioContext.currentTime;
    this.rateGain.gain.cancelScheduledValues(now);
    this.rateGain.gain.setValueAtTime(hz, now);
  }

  /** Sets the fade-in duration (clamped to 0–2 s). */
  setFadeIn(duration: number): void {
    this.fadeInDuration = Math.max(0, Math.min(2, duration));
  }

  setDepth(amount: number): void {
    this.depthGain.gain.value = amount;
  }

  setShape(type: OscillatorType): void {
    this.shape = type;
    if (this.oscillatorNode) {
      this.oscillatorNode.type = type;
    }
  }

  /** Returns seconds elapsed since the LFO oscillator last started or retriggered.
   * Used by the panel to mirror the LFO phase in JS for the visual indicator. */
  getElapsedTime(): number {
    return this.audioContext.currentTime - this.oscillatorStartTime;
  }

  /** Connect the LFO output to an AudioParam (additive modulation). */
  connectTo(param: AudioParam): void {
    this.depthGain.connect(param);
  }

  /** Disconnect from a specific AudioParam.  No-ops if not currently connected. */
  disconnectFrom(param: AudioParam): void {
    try {
      this.depthGain.disconnect(param);
    } catch {
      // not connected — safe to ignore
    }
  }

  /**
   * Returns the depth GainNode so external code can connect it as an AudioNode
   * source to fan-out inputs (e.g. the oscMix GainNode in VoiceManager).
   */
  getOutput(): GainNode {
    return this.depthGain;
  }

  /**
   * Returns the rate AudioParam for external modulation (e.g., from another LFO).
   * Modulation is additive with the base rate set via setRate().
   */
  getRateParam(): AudioParam {
    return this.rateGain.gain;
  }

  /**
   * Returns the depth AudioParam for external modulation (e.g., from another LFO).
   * Modulation is additive with the base depth set via setDepth().
   */
  getDepthParam(): AudioParam {
    return this.depthGain.gain;
  }

  disconnect(): void {
    if (this.oscillatorNode) {
      try { this.oscillatorNode.stop(); } catch { /* already stopped */ }
      this.oscillatorNode.disconnect();
      this.oscillatorNode = null;
    }
    try { this.rateSource.stop(); } catch { /* already stopped */ }
    this.rateSource.disconnect();
    this.rateGain.disconnect();
    this.depthGain.disconnect();
  }

  private startOscillator(): void {
    this.oscillatorStartTime = this.audioContext.currentTime;
    this.oscillatorNode = this.audioContext.createOscillator();
    this.oscillatorNode.type = this.shape;
    this.oscillatorNode.frequency.value = 0; // rate comes from rateGain
    this.rateGain.connect(this.oscillatorNode.frequency);
    this.oscillatorNode.connect(this.depthGain);
    this.oscillatorNode.start();
  }
}
