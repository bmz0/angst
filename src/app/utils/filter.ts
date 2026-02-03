export interface FilterConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  type?: BiquadFilterType;
  frequency?: number;
  Q?: number;
  enabled?: boolean;
  keyboardTracking?: number; // 0 = no tracking, 1 = full tracking
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

  // Compressor constants
  private readonly COMPRESSOR_THRESHOLD = -24; // dB
  private readonly COMPRESSOR_KNEE = 30; // dB
  private readonly COMPRESSOR_RATIO = 12; // :1
  private readonly COMPRESSOR_ATTACK = 0.003; // seconds
  private readonly COMPRESSOR_RELEASE = 0.25; // seconds

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
    this.compressorNode.threshold.value = this.COMPRESSOR_THRESHOLD;
    this.compressorNode.knee.value = this.COMPRESSOR_KNEE;
    this.compressorNode.ratio.value = this.COMPRESSOR_RATIO;
    this.compressorNode.attack.value = this.COMPRESSOR_ATTACK;
    this.compressorNode.release.value = this.COMPRESSOR_RELEASE;

    // Create dry/wet gain nodes for bypass
    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    // Create mixer node where dry/wet combine
    this.mixerNode = this.audioContext.createGain();
    this.mixerNode.gain.value = 1;

    // Wire up nodes: filter → compressor → wetGain
    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.filterNode);
    this.filterNode.connect(this.compressorNode);
    this.compressorNode.connect(this.wetGainNode);
    this.dryGainNode.connect(this.mixerNode);
    this.wetGainNode.connect(this.mixerNode);
    this.mixerNode.connect(config.destination);

    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateBypass();
  }

  setType(type: BiquadFilterType): void {
    this.filterNode.type = type;
  }

  setFrequency(frequency: number): void {
    this.baseFrequency = frequency;
    const now = this.audioContext.currentTime;
    this.filterNode.frequency.setValueAtTime(frequency, now);
  }

  setQ(q: number): void {
    const now = this.audioContext.currentTime;
    this.filterNode.Q.setValueAtTime(q, now);
  }

  setKeyboardTracking(amount: number): void {
    this.keyboardTracking = Math.max(0, Math.min(1, amount));
  }

  trackNote(noteFrequency: number): void {
    if (this.keyboardTracking === 0) return;

    const now = this.audioContext.currentTime;
    // Calculate tracked frequency: baseFreq + (noteFreq - baseFreq) * tracking
    const trackedFrequency = this.baseFrequency + 
      (noteFrequency - this.baseFrequency) * this.keyboardTracking;
    
    // Clamp to valid filter range (20Hz - 20kHz)
    const clampedFrequency = Math.max(20, Math.min(20000, trackedFrequency));
    
    this.filterNode.frequency.setValueAtTime(clampedFrequency, now);
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
