export type SupportedFilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  type?: SupportedFilterType;
  frequency?: number;
  Q?: number;
  enabled?: boolean;
  keyboardTracking?: number;
  postGain?: number;
  envelopeEnabled?: boolean;
  envelopeAttack?: number;
  envelopeSustain?: number;
  envelopeRelease?: number;
  envelopeBaseLevel?: number;
}

export interface FilterParameters {
  enabled?: boolean;
  type?: SupportedFilterType;
  frequency?: number;
  Q?: number;
  keyboardTracking?: number;
  postGain?: number;
  envelopeEnabled?: boolean;
  envelopeAttack?: number;
  envelopeSustain?: number;
  envelopeRelease?: number;
  envelopeBaseLevel?: number;
}

export class FilterController {
  private filterNode: BiquadFilterNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private compressorNode: DynamicsCompressorNode;
  private inputNode: GainNode;
  private mixerNode: GainNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private baseFrequency: number;
  private keyboardTracking: number;
  private lastTrackedNoteFrequency: number = 0;

  // Filter envelope state
  private filterEnvelopeEnabled: boolean;
  private filterEnvelopeAttack: number;
  private filterEnvelopeSustain: number;
  private filterEnvelopeRelease: number;
  private filterEnvelopeBaseLevel: number;

  // Tracked gain values for testable reads (AudioParam.value is intrinsic, not scheduled)
  private _dryGainValue: number = 1;
  private _wetGainValue: number = 0;

  // Compressor constants
  private readonly COMPRESSOR_KNEE = 30; // dB
  private readonly COMPRESSOR_RATIO = 12; // :1
  private readonly COMPRESSOR_ATTACK = 0.003; // seconds
  private readonly COMPRESSOR_RELEASE = 0.25; // seconds
  
  // Q-based threshold mapping constants
  private readonly MIN_Q = 0;
  private readonly MAX_Q = 40;
  private readonly MIN_THRESHOLD = 0; // dB at Q=0
  private readonly MAX_THRESHOLD = -32; // dB at Q=32

  constructor(config: FilterConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled ?? false;
    this.baseFrequency = config.frequency ?? 1000;
    this.keyboardTracking = config.keyboardTracking ?? 0;

    // Filter envelope defaults
    this.filterEnvelopeEnabled = config.envelopeEnabled ?? false;
    this.filterEnvelopeAttack = config.envelopeAttack ?? 0.005;
    this.filterEnvelopeSustain = config.envelopeSustain ?? 0.7;
    this.filterEnvelopeRelease = config.envelopeRelease ?? 0.5;
    this.filterEnvelopeBaseLevel = Math.max(0, Math.min(1, config.envelopeBaseLevel ?? 0));

    // Create input node
    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    // Create filter
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = config.type ?? 'lowpass';
    this.filterNode.frequency.value = this.baseFrequency;
    this.filterNode.Q.value = config.Q ?? 1;

    // Create compressor for wet signal only
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.compressorNode.knee.value = this.COMPRESSOR_KNEE;
    this.compressorNode.ratio.value = this.COMPRESSOR_RATIO;
    this.compressorNode.attack.value = this.COMPRESSOR_ATTACK;
    this.compressorNode.release.value = this.COMPRESSOR_RELEASE;

    // Create dry/wet gain nodes for bypass
    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    // Create mixer node where dry/wet combine
    this.mixerNode = this.audioContext.createGain();
    this.mixerNode.gain.value = config.postGain ?? 1;

    // Wire up nodes: filter → compressor → wetGain
    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.filterNode);
    this.filterNode.connect(this.compressorNode);
    this.compressorNode.connect(this.wetGainNode);
    this.wetGainNode.connect(this.mixerNode);
    this.dryGainNode.connect(config.destination);
    this.mixerNode.connect(config.destination);

    // Set initial threshold based on Q
    this.updateCompressorThreshold(config.Q ?? 1);
    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  getDryGainValue(): number {
    return this._dryGainValue;
  }

  getWetGainValue(): number {
    return this._wetGainValue;
  }

  getFilterEnvelopeParams(): {
    enabled: boolean;
    attack: number;
    sustain: number;
    release: number;
    baseLevel: number;
  } {
    return {
      enabled: this.filterEnvelopeEnabled,
      attack: this.filterEnvelopeAttack,
      sustain: this.filterEnvelopeSustain,
      release: this.filterEnvelopeRelease,
      baseLevel: this.filterEnvelopeBaseLevel,
    };
  }

  triggerEnvelope(): void {
    if (!this.enabled || !this.filterEnvelopeEnabled) return;

    const now = this.audioContext.currentTime;
    const {
      filterEnvelopeAttack: attack,
      filterEnvelopeSustain: sustain,
      filterEnvelopeBaseLevel: baseLevel,
    } = this;

    // wet: baseLevel → sustain (over attack time)
    this.wetGainNode.gain.cancelScheduledValues(now);
    this._wetGainValue = baseLevel;
    this.wetGainNode.gain.setValueAtTime(baseLevel, now);
    this.wetGainNode.gain.linearRampToValueAtTime(sustain, now + attack);

    // dry: mirrors wet
    this.dryGainNode.gain.cancelScheduledValues(now);
    this._dryGainValue = 1 - baseLevel;
    this.dryGainNode.gain.setValueAtTime(1 - baseLevel, now);
    this.dryGainNode.gain.linearRampToValueAtTime(1 - sustain, now + attack);
  }

  releaseEnvelope(): void {
    if (!this.enabled || !this.filterEnvelopeEnabled) return;

    const now = this.audioContext.currentTime;
    const { filterEnvelopeRelease: release, filterEnvelopeBaseLevel: baseLevel } = this;
    const currentWet = this.wetGainNode.gain.value;
    const currentDry = this.dryGainNode.gain.value;

    // wet: current → baseLevel; dry: current → (1 - baseLevel)
    this.wetGainNode.gain.cancelScheduledValues(now);
    this.wetGainNode.gain.setValueAtTime(currentWet, now);
    this.wetGainNode.gain.linearRampToValueAtTime(baseLevel, now + release);

    this.dryGainNode.gain.cancelScheduledValues(now);
    this.dryGainNode.gain.setValueAtTime(currentDry, now);
    this.dryGainNode.gain.linearRampToValueAtTime(1 - baseLevel, now + release);
  }

  setParameters(params: FilterParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.type !== undefined) {
      this.filterNode.type = params.type;
    }

    if (params.frequency !== undefined) {
      this.baseFrequency = params.frequency;
      this.trackNote(this.lastTrackedNoteFrequency);
    }
    
    if (params.Q !== undefined) {
      this.filterNode.Q.setValueAtTime(params.Q, now);
      this.updateCompressorThreshold(params.Q);
    }
    
    if (params.keyboardTracking !== undefined) {
      this.keyboardTracking = Math.max(0, Math.min(1, params.keyboardTracking));
      this.trackNote(this.lastTrackedNoteFrequency);
    }

    if (params.postGain !== undefined) {
      this.mixerNode.gain.setValueAtTime(params.postGain, now);
    }

    if (params.envelopeEnabled !== undefined) {
      this.filterEnvelopeEnabled = params.envelopeEnabled;
      shouldUpdateBypass = true;
    }
    if (params.envelopeAttack !== undefined) {
      this.filterEnvelopeAttack = params.envelopeAttack;
    }
    if (params.envelopeSustain !== undefined) {
      this.filterEnvelopeSustain = params.envelopeSustain;
    }
    if (params.envelopeRelease !== undefined) {
      this.filterEnvelopeRelease = params.envelopeRelease;
    }
    if (params.envelopeBaseLevel !== undefined) {
      this.filterEnvelopeBaseLevel = Math.max(0, Math.min(1, params.envelopeBaseLevel));
    }

    if (shouldUpdateBypass) {
      this.updateBypass();
    }
  }

  trackNote(noteFrequency: number): void {
    this.lastTrackedNoteFrequency = noteFrequency;
    const now = this.audioContext.currentTime;
    const trackedFrequency = this.baseFrequency + 
      (noteFrequency - this.baseFrequency) * this.keyboardTracking;
    
    this.filterNode.frequency.setValueAtTime(trackedFrequency, now);
  }

  private updateCompressorThreshold(q: number): void {
    // Clamp Q to expected range
    const clampedQ = Math.max(this.MIN_Q, Math.min(this.MAX_Q, q), 0.0000001);
    
    const normalizedQ = Math.log(clampedQ) / Math.log(this.MAX_Q);
    const threshold = this.MIN_THRESHOLD + 
      (this.MAX_THRESHOLD - this.MIN_THRESHOLD) * normalizedQ;
    
    const now = this.audioContext.currentTime;
    this.compressorNode.threshold.setValueAtTime(threshold, now);
  }

  private updateBypass(): void {
    const now = this.audioContext.currentTime;
    this.dryGainNode.gain.cancelScheduledValues(now);
    this.wetGainNode.gain.cancelScheduledValues(now);
    if (this.enabled) {
      this._dryGainValue = 0;
      this._wetGainValue = 1;
      this.dryGainNode.gain.value = 0;
      this.wetGainNode.gain.value = 1;
    } else {
      this._dryGainValue = 1;
      this._wetGainValue = 0;
      this.dryGainNode.gain.value = 1;
      this.wetGainNode.gain.value = 0;
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.filterNode.disconnect();
    this.compressorNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
    this.mixerNode.disconnect();
  }
}
