export interface DelayConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  delayTime: number;
  feedback: number;
  mix: number;
  enabled: boolean;
}

export interface DelayParameters {
  enabled?: boolean;
  delayTime?: number;
  feedback?: number;
  mix?: number;
}

export class DelayController {
  private inputNode: GainNode;
  private delayNode: DelayNode;
  private feedbackNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private readonly audioContext: AudioContext;
  private enabled: boolean;
  private mix: number;

  constructor(config: DelayConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled;
    this.mix = config.mix;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.delayNode = this.audioContext.createDelay(5.0);
    this.delayNode.delayTime.value = config.delayTime;

    this.feedbackNode = this.audioContext.createGain();
    this.feedbackNode.gain.value = config.feedback;

    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackNode);
    this.feedbackNode.connect(this.delayNode);
    this.delayNode.connect(this.wetGainNode);
    this.dryGainNode.connect(config.destination);
    this.wetGainNode.connect(config.destination);

    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  setParameters(params: DelayParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.mix !== undefined) {
      this.mix = params.mix;
      if (this.enabled) {
        this.wetGainNode.gain.setValueAtTime(params.mix, now);
        this.dryGainNode.gain.setValueAtTime(1, now);
      }
    }

    if (params.delayTime !== undefined) {
      this.delayNode.delayTime.setValueAtTime(params.delayTime, now);
    }

    if (params.feedback !== undefined) {
      this.feedbackNode.gain.setValueAtTime(params.feedback, now);
    }

    if (shouldUpdateBypass) {
      this.updateBypass();
    }
  }

  private updateBypass(): void {
    const now = this.audioContext.currentTime;
    if (this.enabled) {
      this.wetGainNode.gain.setValueAtTime(this.mix, now);
      this.dryGainNode.gain.setValueAtTime(1 - this.mix, now);
    } else {
      this.wetGainNode.gain.setValueAtTime(0, now);
      this.dryGainNode.gain.setValueAtTime(1, now);
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.delayNode.disconnect();
    this.feedbackNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
