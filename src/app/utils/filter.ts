export interface FilterConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  type?: BiquadFilterType;
  frequency?: number;
  Q?: number;
  gain?: number;
  enabled?: boolean;
}

export class FilterController {
  private filterNode: BiquadFilterNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private inputNode: GainNode;
  private readonly audioContext: AudioContext;
  private enabled: boolean;

  constructor(config: FilterConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled ?? false;

    // Create input node
    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    // Create filter
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = config.type ?? 'lowpass';
    this.filterNode.frequency.value = config.frequency ?? 1000;
    this.filterNode.Q.value = config.Q ?? 1;
    this.filterNode.gain.value = config.gain ?? 0;

    // Create dry/wet gain nodes for bypass
    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    // Wire up nodes
    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.filterNode);
    this.filterNode.connect(this.wetGainNode);
    this.dryGainNode.connect(config.destination);
    this.wetGainNode.connect(config.destination);

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
    const now = this.audioContext.currentTime;
    this.filterNode.frequency.setValueAtTime(frequency, now);
  }

  setQ(q: number): void {
    const now = this.audioContext.currentTime;
    this.filterNode.Q.setValueAtTime(q, now);
  }

  setGain(gain: number): void {
    const now = this.audioContext.currentTime;
    this.filterNode.gain.setValueAtTime(gain, now);
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
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
