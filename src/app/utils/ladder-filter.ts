/**
 * LadderFilterController — controller wrapper for the "ladder-filter"
 * AudioWorklet processor defined in ladder-filter.worklet.ts.
 *
 * Public API is intentionally parallel to FilterController so SynthEngine
 * can call the same methods (getInput, trackNote, triggerEnvelope,
 * releaseEnvelope, setParameters, disconnect) on either controller.
 *
 * Key differences from FilterController:
 *   - Core node is AudioWorkletNode, not BiquadFilterNode → always lowpass,
 *     with per-stage tanh saturation.
 *   - No DynamicsCompressorNode — the worklet's internal nonlinearity acts
 *     as a soft clipper and prevents runaway resonance peaks.
 *   - resonance (0–4) and drive (0.5–10) are first-class parameters with
 *     their own worklet AudioParams.
 *   - getCutoffParam() exposes the worklet's a-rate cutoff AudioParam for
 *     direct automation (analogous to FilterController.getFrequencyParam()).
 *
 * Prerequisites:
 *   The 'ladder-filter' processor must be registered in the AudioContext
 *   before this class is instantiated.  Call SynthEngine.preload(ctx) and
 *   await it before constructing a SynthEngine (and therefore this class).
 */

export interface LadderFilterConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  frequency?: number;
  /** Feedback amount: 0 (none) to 4 (near self-oscillation). Default: 0. */
  resonance?: number;
  /** Input gain before feedback subtraction: 0.5–10.  >1 adds harmonic content. Default: 1. */
  drive?: number;
  enabled?: boolean;
  keyboardTracking?: number;
  postGain?: number;
}

export interface LadderFilterParameters {
  enabled?: boolean;
  frequency?: number;
  resonance?: number;
  drive?: number;
  keyboardTracking?: number;
  postGain?: number;
}

export class LadderFilterController {
  private readonly workletNode: AudioWorkletNode;
  private readonly inputNode: GainNode;
  private readonly dryGainNode: GainNode;
  private readonly wetGainNode: GainNode;
  private readonly mixerNode: GainNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private baseFrequency: number;
  private keyboardTracking: number;
  private lastTrackedNoteFrequency: number = 0;

  // Tracked gain values for testable reads (AudioParam.value is intrinsic, not scheduled)
  private _dryGainValue: number = 1;
  private _wetGainValue: number = 0;

  constructor(config: LadderFilterConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled ?? false;
    this.baseFrequency = config.frequency ?? 1000;
    this.keyboardTracking = config.keyboardTracking ?? 0;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.workletNode = new AudioWorkletNode(this.audioContext, 'ladder-filter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      // Force the browser to upmix a mono upstream signal to stereo before
      // feeding it into the worklet.  Without this the worklet only sees one
      // input channel and the right output channel is silent.
      channelCount: 2,
      channelCountMode: 'explicit',
    });

    this.param('cutoff').value = this.baseFrequency;
    this.param('resonance').value = Math.max(0, Math.min(4, config.resonance ?? 0));
    this.param('drive').value = Math.max(0.5, Math.min(10, config.drive ?? 1));

    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    this.mixerNode = this.audioContext.createGain();
    this.mixerNode.gain.value = config.postGain ?? 1;

    // input → [dryGain → destination]
    //       → [workletNode → wetGain → mixerNode → destination]
    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.workletNode);
    this.workletNode.connect(this.wetGainNode);
    this.wetGainNode.connect(this.mixerNode);
    this.dryGainNode.connect(config.destination);
    this.mixerNode.connect(config.destination);

    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  /**
   * Exposes the worklet's a-rate cutoff AudioParam for direct automation,
   * e.g. scheduling a per-trigger frequency sweep.
   */
  getCutoffParam(): AudioParam {
    return this.param('cutoff');
  }

  getResonanceParam(): AudioParam {
    return this.param('resonance');
  }

  getDryGainValue(): number {
    return this._dryGainValue;
  }

  getWetGainValue(): number {
    return this._wetGainValue;
  }

  setParameters(params: LadderFilterParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.frequency !== undefined) {
      this.baseFrequency = params.frequency;
      this.trackNote(this.lastTrackedNoteFrequency);
    }

    if (params.resonance !== undefined) {
      this.param('resonance').setValueAtTime(Math.max(0, Math.min(4, params.resonance)), now);
    }

    if (params.drive !== undefined) {
      this.param('drive').setValueAtTime(Math.max(0.5, Math.min(10, params.drive)), now);
    }

    if (params.keyboardTracking !== undefined) {
      this.keyboardTracking = Math.max(0, Math.min(1, params.keyboardTracking));
      this.trackNote(this.lastTrackedNoteFrequency);
    }

    if (params.postGain !== undefined) {
      this.mixerNode.gain.setValueAtTime(params.postGain, now);
    }

    if (shouldUpdateBypass) {
      this.updateBypass();
    }
  }

  trackNote(noteFrequency: number, at?: number): void {
    this.lastTrackedNoteFrequency = noteFrequency;
    const now = this.audioContext.currentTime;
    const t = at ?? now;
    const trackedFrequency =
      this.baseFrequency + (noteFrequency - this.baseFrequency) * this.keyboardTracking;

    this.param('cutoff').setValueAtTime(trackedFrequency, t);
  }

  private param(name: string): AudioParam {
    return this.workletNode.parameters.get(name)!;
  }

  private updateBypass(): void {
    const now = this.audioContext.currentTime;
    this.dryGainNode.gain.cancelScheduledValues(now);
    this.wetGainNode.gain.cancelScheduledValues(now);

    if (this.enabled) {
      this._dryGainValue = 0;
      this._wetGainValue = 1;
      this.dryGainNode.gain.setValueAtTime(0, now);
      this.wetGainNode.gain.setValueAtTime(1, now);
    } else {
      this._dryGainValue = 1;
      this._wetGainValue = 0;
      this.dryGainNode.gain.setValueAtTime(1, now);
      this.wetGainNode.gain.setValueAtTime(0, now);
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.workletNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
    this.mixerNode.disconnect();
  }
}
