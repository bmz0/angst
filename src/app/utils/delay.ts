export interface DelayConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  delayTime: number;
  feedback: number;
  mix: number;
  enabled: boolean;
  pingPong?: boolean;
  pingPongWidth?: number;
}

export interface DelayParameters {
  enabled?: boolean;
  delayTime?: number;
  feedback?: number;
  mix?: number;
  pingPong?: boolean;
  pingPongWidth?: number;
}

export class DelayController {
  private inputNode: GainNode;
  private delayNode: DelayNode;
  private feedbackNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private stereoPannerNode: StereoPannerNode;
  private readonly audioContext: AudioContext;
  private enabled: boolean;
  private mix: number;
  private pingPong: boolean;
  private pingPongWidth: number;
  private panDirection: number;
  private pingPongInterval?: number;

  constructor(config: DelayConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled;
    this.mix = config.mix;
    this.pingPong = config.pingPong ?? true;
    this.pingPongWidth = config.pingPongWidth ?? 0.3;
    this.panDirection = 1;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.delayNode = this.audioContext.createDelay(5.0);
    this.delayNode.delayTime.value = config.delayTime;

    this.feedbackNode = this.audioContext.createGain();
    this.feedbackNode.gain.value = config.feedback;

    this.stereoPannerNode = this.audioContext.createStereoPanner();
    this.stereoPannerNode.pan.value = this.pingPongWidth * this.panDirection;

    this.dryGainNode = this.audioContext.createGain();
    this.dryGainNode.gain.value = 1;
    this.wetGainNode = this.audioContext.createGain();

    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackNode);
    this.feedbackNode.connect(this.delayNode);
    this.delayNode.connect(this.stereoPannerNode);
    this.stereoPannerNode.connect(this.wetGainNode);
    this.dryGainNode.connect(config.destination);
    this.wetGainNode.connect(config.destination);

    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  swicthPan(): void {
    if (!this.pingPong) {
      return;
    }

    this.panDirection *= -1;
    const now = this.audioContext.currentTime;
    this.stereoPannerNode.pan.setValueAtTime(
      this.panDirection * this.pingPongWidth,
      now
    );
  }

  setParameters(params: DelayParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
      if (this.enabled) {
        this.pingPongInterval = setInterval(() => this.swicthPan(), this.delayNode.delayTime.value * 1000); 
      } else {
        clearInterval(this.pingPongInterval);
      }
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

    if (params.pingPong !== undefined) {
      this.pingPong = params.pingPong;
      if (!this.pingPong) {
        this.stereoPannerNode.pan.setValueAtTime(0, now);
        this.panDirection = 1;
      }
    }

    if (params.pingPongWidth !== undefined) {
      this.pingPongWidth = params.pingPongWidth;
      if (this.pingPong) {
        this.stereoPannerNode.pan.setValueAtTime(
          this.panDirection * this.pingPongWidth,
          now
        );
      }
    }

    if (shouldUpdateBypass) {
      this.updateBypass();
    }
  }

  private updateBypass(): void {
    const now = this.audioContext.currentTime;
    if (this.enabled) {
      this.wetGainNode.gain.setValueAtTime(this.mix, now);
    } else {
      this.wetGainNode.gain.setValueAtTime(0, now);
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.delayNode.disconnect();
    this.feedbackNode.disconnect();
    this.stereoPannerNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
