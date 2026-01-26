export interface DelayConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  delayTime?: number;
  feedback?: number;
  mix?: number;
  enabled?: boolean;
}

export interface DelayParams {
  delayTime?: number;
  feedback?: number;
  mix?: number;
  enabled?: boolean;
}

export class DelayController {
  private readonly audioContext: AudioContext;
  private readonly delayNode: DelayNode;
  private readonly feedbackGain: GainNode;
  private readonly inputSplitter: ChannelSplitterNode;
  private readonly wetGain: GainNode;
  private readonly dryGain: GainNode;
  private readonly outputGain: GainNode;
  private delayEnabled: boolean = false;

  constructor(config: DelayConfig) {
    this.audioContext = config.audioContext;
    this.delayEnabled = config.enabled ?? false;

    this.inputSplitter = this.audioContext.createGain();

    // Create delay node
    this.delayNode = this.audioContext.createDelay(5.0); // Max 5 seconds
    this.delayNode.delayTime.value = config.delayTime ?? 0.3;

    // Create feedback loop
    this.feedbackGain = this.audioContext.createGain();
    this.feedbackGain.gain.value = config.feedback ?? 0.3;

    // Create wet/dry mix
    this.wetGain = this.audioContext.createGain();
    this.dryGain = this.audioContext.createGain();
    this.outputGain = this.audioContext.createGain();

    // Wire feedback loop: delay → feedbackGain → delay
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // Wire wet/dry mix
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
    this.dryGain.connect(this.outputGain);
    
    this.outputGain.connect(config.destination);
    this.inputSplitter.connect(this.dryGain);
    this.inputSplitter.connect(this.delayNode);
    
    // Set initial mix
    this.setMix(config.mix ?? 0.3);
    this.setEnabled(config.enabled ?? false);
  }

  getInput(): AudioNode {
    return this.inputSplitter;
  }

  setParams(params: DelayParams): void {
    if (params.delayTime !== undefined) {
      this.setDelayTime(params.delayTime);
    }
    if (params.feedback !== undefined) {
      this.setFeedback(params.feedback);
    }
    if (params.mix !== undefined) {
      this.setMix(params.mix);
    }
    if (params.enabled !== undefined) {
      this.setEnabled(params.enabled);
    }
  }

  getParams(): Required<DelayParams> {
    return {
      delayTime: this.delayNode.delayTime.value,
      feedback: this.feedbackGain.gain.value,
      mix: this.wetGain.gain.value,
      enabled: this.delayEnabled
    };
  }

  setDelayTime(time: number): void {
    const clampedTime = Math.max(0, Math.min(5.0, time));
    this.delayNode.delayTime.setValueAtTime(
      clampedTime,
      this.audioContext.currentTime
    );
  }

  getDelayTime(): number {
    return this.delayNode.delayTime.value;
  }

  setFeedback(feedback: number): void {
    const clampedFeedback = Math.max(0, Math.min(0.95, feedback));
    this.feedbackGain.gain.setValueAtTime(
      clampedFeedback,
      this.audioContext.currentTime
    );
  }

  getFeedback(): number {
    return this.feedbackGain.gain.value;
  }

  setMix(mix: number): void {
    const clampedMix = Math.max(0, Math.min(1, mix));
    const now = this.audioContext.currentTime;
    
    this.wetGain.gain.setValueAtTime(clampedMix, now);
    this.dryGain.gain.setValueAtTime(1 - clampedMix, now);
  }

  getMix(): number {
    return this.wetGain.gain.value;
  }

  setEnabled(enabled: boolean): void {
    this.delayEnabled = enabled;
    const now = this.audioContext.currentTime;
    
    if (enabled) {
      // Set wet and dry gains based on current mix
      const currentMix = this.getMix();
      //this.feedbackGain.connect(this.delayNode);
      this.inputSplitter.connect(this.delayNode);
      this.wetGain.gain.setValueAtTime(currentMix, now);
      this.dryGain.gain.setValueAtTime(1 - currentMix, now);
    } else {
      this.inputSplitter.disconnect(this.delayNode);
      // Set wet to 0, dry to 1 when disabled
      this.wetGain.gain.setValueAtTime(0, now);
      this.dryGain.gain.setValueAtTime(1, now);
    }
  }

  isEnabled(): boolean {
    return this.delayEnabled;
  }

  disconnect(): void {
    this.delayNode.disconnect();
    this.feedbackGain.disconnect();
    this.wetGain.disconnect();
    this.dryGain.disconnect();
    this.outputGain.disconnect();
  }
}
