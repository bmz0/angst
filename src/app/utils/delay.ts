export interface DelayConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  delayTime: number;
  feedback: number;
  mix: number;
  enabled: boolean;
  pingPong?: boolean;
  delayPan?: number;
}

export interface DelayParameters {
  enabled?: boolean;
  delayTime?: number;
  feedback?: number;
  mix?: number;
  pingPong?: boolean;
  delayPan?: number;
}

export class DelayController {
  private inputNode: GainNode;
  private delayNode: DelayNode;
  private feedbackNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private stereoPannerNode: StereoPannerNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private mix: number;
  private pingPong: boolean;
  private delayPan: number;
  private currentPan: number;
  private panDirection: number;
  private pingPongInterval?: number;

  constructor(config: DelayConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled;
    this.mix = config.mix;
    this.pingPong = config.pingPong ?? true;
    this.delayPan = config.delayPan ?? 0;
    this.currentPan = this.delayPan;
    this.panDirection = 1;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.delayNode = this.audioContext.createDelay(5.0);
    this.delayNode.delayTime.value = config.delayTime;

    this.feedbackNode = this.audioContext.createGain();
    this.feedbackNode.gain.value = config.feedback;

    this.stereoPannerNode = this.audioContext.createStereoPanner();
    this.stereoPannerNode.pan.value = this.currentPan;

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
    if (this.enabled && this.pingPong) {
      this.startPingPong();
    }
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  getCurrentPan(): number {
    return this.currentPan;
  }

  isPingPong(): boolean {
    return this.pingPong;
  }

  getDelayPan(): number {
    return this.delayPan;
  }

  private setPanWithRamp(targetPan: number, now: number): void {
    const rampTime = this.delayNode.delayTime.value / 2;
    this.stereoPannerNode.pan.cancelScheduledValues(now);
    this.stereoPannerNode.pan.setValueAtTime(this.currentPan, now);
    this.stereoPannerNode.pan.linearRampToValueAtTime(targetPan, now + rampTime);
  }

  private startPingPong(): void {
    clearInterval(this.pingPongInterval);
    this.panDirection = 1;
    this.currentPan = this.delayPan;
    this.stereoPannerNode.pan.cancelScheduledValues(this.audioContext.currentTime);
    this.stereoPannerNode.pan.setValueAtTime(this.delayPan, this.audioContext.currentTime);
    this.pingPongInterval = setInterval(
      () => this.switchPan(),
      this.delayNode.delayTime.value * 1000
    );
  }

  switchPan(): void {
    if (!this.pingPong) {
      return;
    }

    this.panDirection *= -1;
    const now = this.audioContext.currentTime;
    this.currentPan = this.panDirection * this.delayPan;
    this.setPanWithRamp(this.currentPan, now);
  }

  setParameters(params: DelayParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
      if (this.enabled && this.pingPong) {
        this.startPingPong();
      } else {
        clearInterval(this.pingPongInterval);
      }
    }

    if (params.mix !== undefined) {
      this.mix = params.mix;
      if (this.enabled) {
        this.wetGainNode.gain.setValueAtTime(params.mix, now);
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
        clearInterval(this.pingPongInterval);
        this.panDirection = 1;
        this.currentPan = this.delayPan;
        this.setPanWithRamp(this.delayPan, now);
      } else if (this.enabled) {
        this.startPingPong();
      }
    }

    if (params.delayPan !== undefined) {
      this.delayPan = params.delayPan;
      if (!this.pingPong) {
        this.currentPan = this.delayPan;
        this.setPanWithRamp(this.delayPan, now);
      } else {
        this.currentPan = this.panDirection * this.delayPan;
        this.setPanWithRamp(this.currentPan, now);
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
    clearInterval(this.pingPongInterval);
    this.inputNode.disconnect();
    this.delayNode.disconnect();
    this.feedbackNode.disconnect();
    this.stereoPannerNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
