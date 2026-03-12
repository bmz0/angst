export type SupportedFilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  type?: SupportedFilterType;
  frequency?: number;
  Q?: number;
  enabled?: boolean;
  keyboardTracking?: number;
  postGain?: number;
}

export interface FilterParameters {
  enabled?: boolean;
  type?: SupportedFilterType;
  frequency?: number;
  Q?: number;
  keyboardTracking?: number;
  postGain?: number;
}

export class FilterController {
  private filterNode: BiquadFilterNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private compressorNode: DynamicsCompressorNode;
  private inputNode: GainNode;
  private mixerNode: GainNode;
  private readonly audioContext: AudioContext;
  private enabled: boolean;
  private baseFrequency: number;
  private keyboardTracking: number;
  private lastTrackedNoteFrequency: number = 0;

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
    if (this.enabled) {
      this.dryGainNode.gain.setValueAtTime(0, now);
      this.wetGainNode.gain.setValueAtTime(1, now);
    } else {
      this.dryGainNode.gain.setValueAtTime(1, now);
      this.wetGainNode.gain.setValueAtTime(0, now);
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
