/**
 * CombFilterController — feedforward / feedback comb filter using the
 * Web Audio API's native DelayNode.  No AudioWorklet required.
 *
 * Two topologies, selectable at runtime via `feedback` (boolean):
 *
 *   Feedforward (default):
 *     y[n] = x[n] + gain · x[n − D]
 *     Produces notch comb (gain=−1) or peak comb (gain=+1).
 *     Unconditionally stable at any gain value.
 *
 *   Feedback:
 *     y[n] = x[n] + gain · y[n − D]
 *     Produces resonant Schroeder-style peaks.
 *     Stable only when |gain| < 1 — enforced by clamping to ±0.95.
 *
 * ─── Parameters ───────────────────────────────────────────────────────────────
 *   delayTime  s      [0.00005, 0.02]  Default: 0.001
 *              Delay length in seconds.  First comb null/peak:
 *                feedforward: f_null  = 1 / (2·D)  at gain=−1
 *                feedback:    f_peak  = 1 / D
 *              Range 0.05 ms – 20 ms → fundamentals ≈ 50 Hz – 10 kHz.
 *              Exposed as an AudioParam so an LFO can modulate it
 *              click-free (flanger effect).
 *
 *   gain       –      [−1, 1]          Default: −0.7
 *              Comb depth and polarity.  0 = bypass (no comb character).
 *
 *   feedback   bool                    Default: false
 *              When true, routes the delay output back to the delay input
 *              (Schroeder topology) instead of the comb summing node.
 *
 *   postGain   –      [0, 2]           Default: 1
 *   enabled    bool                    Default: false
 *
 * ─── Signal graph ─────────────────────────────────────────────────────────────
 *
 *  Feedforward:
 *    input ─────────────────────────────────────────────────── sumNode ─→ wet ─→ mixer ─→ dest
 *          └─→ delayNode ─→ combGainNode ──────────────────────┘
 *
 *  Feedback:
 *    input ─→ sumNode ─→ delayNode ─→ combGainNode ─┬─→ wet ─→ mixer ─→ dest
 *              ↑                                      │
 *              └──────────────────────────────────────┘
 *
 *  Both wrapped in dry/wet bypass:
 *    input ─→ dryGain ──────────────────────────────────────────────────→ dest
 *          └─→ [topology above] ─→ wetGain ─→ mixerNode(postGain) ──────┘
 */

export interface CombFilterConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  delayTime?: number;
  gain?: number;
  feedback?: boolean;
  enabled?: boolean;
  postGain?: number;
  keyboardTracking?: number;
}

export interface CombFilterParameters {
  enabled?: boolean;
  delayTime?: number;
  gain?: number;
  feedback?: boolean;
  postGain?: number;
  keyboardTracking?: number;
}

const MIN_DELAY = 0.00005;  // 0.05 ms  → ~10 kHz first null
const MAX_DELAY = 0.02;     // 20 ms    → ~25 Hz first null
const MAX_FEEDBACK_GAIN = 0.95;

export class CombFilterController {
  private readonly audioContext: BaseAudioContext;
  private readonly inputNode: GainNode;
  private readonly dryGainNode: GainNode;
  private readonly wetGainNode: GainNode;
  private readonly mixerNode: GainNode;

  // Comb graph nodes
  private readonly delayNode: DelayNode;
  private readonly combGainNode: GainNode;
  private readonly sumNode: GainNode;

  private enabled: boolean;
  private isFeedback: boolean;
  private gainValue: number;
  private baseDelayTime: number;
  private keyboardTracking: number;
  private lastTrackedNoteFrequency: number = 0;
  private readonly destination: AudioNode;

  private _dryGainValue: number = 1;
  private _wetGainValue: number = 0;

  constructor(config: CombFilterConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled ?? false;
    this.isFeedback = config.feedback ?? false;
    this.gainValue = config.gain ?? -0.7;
    this.baseDelayTime = Math.max(MIN_DELAY, Math.min(MAX_DELAY, config.delayTime ?? 0.001));
    this.keyboardTracking = Math.max(0, Math.min(1, config.keyboardTracking ?? 0));
    this.destination = config.destination;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.delayNode = this.audioContext.createDelay(MAX_DELAY);
    this.delayNode.delayTime.value = this.baseDelayTime;

    this.combGainNode = this.audioContext.createGain();
    this.combGainNode.gain.value = this.clampGain(this.gainValue);

    this.sumNode = this.audioContext.createGain();
    this.sumNode.gain.value = 1;

    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    this.mixerNode = this.audioContext.createGain();
    this.mixerNode.gain.value = config.postGain ?? 1;

    // Bypass wiring
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.destination);
    this.wetGainNode.connect(this.mixerNode);
    this.mixerNode.connect(this.destination);

    this.wireCombTopology();
    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  /** Exposes DelayNode.delayTime as an AudioParam for LFO connection. */
  getDelayTimeParam(): AudioParam {
    return this.delayNode.delayTime;
  }

  getDryGainValue(): number {
    return this._dryGainValue;
  }

  getWetGainValue(): number {
    return this._wetGainValue;
  }

  setParameters(params: CombFilterParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;
    let shouldRewire = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.delayTime !== undefined) {
      this.baseDelayTime = Math.max(MIN_DELAY, Math.min(MAX_DELAY, params.delayTime));
      this.delayNode.delayTime.setTargetAtTime(
        this.computeTrackedDelay(this.lastTrackedNoteFrequency),
        now,
        0.005
      );
    }

    if (params.gain !== undefined) {
      this.gainValue = params.gain;
      this.combGainNode.gain.setValueAtTime(this.clampGain(this.gainValue), now);
    }

    if (params.feedback !== undefined && params.feedback !== this.isFeedback) {
      this.isFeedback = params.feedback;
      shouldRewire = true;
    }

    if (params.postGain !== undefined) {
      this.mixerNode.gain.setValueAtTime(params.postGain, now);
    }

    if (params.keyboardTracking !== undefined) {
      this.keyboardTracking = Math.max(0, Math.min(1, params.keyboardTracking));
      this.trackNote(this.lastTrackedNoteFrequency);
    }

    if (shouldRewire) {
      this.disconnectCombTopology();
      this.wireCombTopology();
    }

    if (shouldUpdateBypass) {
      this.updateBypass();
    }
  }

  /**
   * Adjusts delayTime to track the played note frequency.
   * At keyboardTracking=0 the base delayTime is unchanged.
   * At keyboardTracking=1 the comb fundamental exactly follows the note pitch.
   */
  trackNote(noteFrequency: number, at?: number, glideTime: number = 0): void {
    const prevNoteFrequency = this.lastTrackedNoteFrequency;
    this.lastTrackedNoteFrequency = noteFrequency;
    const t = at ?? this.audioContext.currentTime;
    const newDelay = this.computeTrackedDelay(noteFrequency);

    this.delayNode.delayTime.cancelScheduledValues(t);
    if (glideTime > 0 && prevNoteFrequency > 0) {
      const prevDelay = this.computeTrackedDelay(prevNoteFrequency);
      this.delayNode.delayTime.setValueAtTime(prevDelay, t);
      this.delayNode.delayTime.linearRampToValueAtTime(newDelay, t + glideTime);
    } else {
      this.delayNode.delayTime.setValueAtTime(newDelay, t);
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.disconnectCombTopology();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
    this.mixerNode.disconnect();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private clampGain(g: number): number {
    const limit = this.isFeedback ? MAX_FEEDBACK_GAIN : 1;
    return Math.max(-limit, Math.min(limit, g));
  }

  /**
   * Computes the tracked delay time for a given note frequency.
   * Interpolates between baseDelayTime (tracking=0) and 1/noteFreq (tracking=1).
   * Falls back to baseDelayTime when noteFrequency is 0 (no note played yet).
   */
  private computeTrackedDelay(noteFrequency: number): number {
    if (noteFrequency <= 0 || this.keyboardTracking === 0) return this.baseDelayTime;
    const noteDelay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, 1 / noteFrequency));
    const tracked = this.baseDelayTime + (noteDelay - this.baseDelayTime) * this.keyboardTracking;
    return Math.max(MIN_DELAY, Math.min(MAX_DELAY, tracked));
  }

  private wireCombTopology(): void {
    if (this.isFeedback) {
      // input → sumNode → delayNode → combGainNode ─┬→ wetGain
      //                    ↑                          │
      //         sumNode ←──┘ (feedback via combGain) ┘
      this.inputNode.connect(this.sumNode);
      this.sumNode.connect(this.delayNode);
      this.delayNode.connect(this.combGainNode);
      this.combGainNode.connect(this.sumNode);   // feedback loop
      this.combGainNode.connect(this.wetGainNode);
    } else {
      // input ──────────────────────────────→ sumNode → wetGain
      //       └→ delayNode → combGainNode ──→ sumNode
      this.inputNode.connect(this.sumNode);
      this.inputNode.connect(this.delayNode);
      this.delayNode.connect(this.combGainNode);
      this.combGainNode.connect(this.sumNode);
      this.sumNode.connect(this.wetGainNode);
    }
  }

  private disconnectCombTopology(): void {
    // Disconnect what wireCombTopology() connected, ignoring errors when
    // a node isn't actually connected (e.g. after construction failures).
    try { this.inputNode.disconnect(this.sumNode); } catch { /* ok */ }
    try { this.inputNode.disconnect(this.delayNode); } catch { /* ok */ }
    try { this.sumNode.disconnect(this.delayNode); } catch { /* ok */ }
    try { this.sumNode.disconnect(this.wetGainNode); } catch { /* ok */ }
    try { this.delayNode.disconnect(this.combGainNode); } catch { /* ok */ }
    try { this.combGainNode.disconnect(this.sumNode); } catch { /* ok */ }
    try { this.combGainNode.disconnect(this.wetGainNode); } catch { /* ok */ }
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
}
