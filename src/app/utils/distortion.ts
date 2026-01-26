export type DistortionType = 'soft' | 'hard';

export interface DistortionConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  type?: DistortionType;
  amount?: number;
  enabled?: boolean;
}

export interface DistortionParams {
  type?: DistortionType;
  amount?: number;
  enabled?: boolean;
}

export class DistortionController {
  private waveShaperNode: WaveShaperNode;
  private readonly audioContext: AudioContext;
  private distortionType: DistortionType = 'hard';
  private distortionAmount: number = 0;
  private distortionEnabled: boolean = false;

  constructor(config: DistortionConfig) {
    this.audioContext = config.audioContext;
    this.distortionType = config.type ?? 'hard';
    this.distortionAmount = config.amount ?? 0;
    this.distortionEnabled = config.enabled ?? false;

    this.waveShaperNode = this.audioContext.createWaveShaper();
    this.waveShaperNode.connect(config.destination);
    this.updateCurve();
  }

  getInput(): WaveShaperNode {
    return this.waveShaperNode;
  }

  setParams(params: DistortionParams): void {
    if (params.type !== undefined) {
      this.distortionType = params.type;
    }
    if (params.amount !== undefined) {
      this.distortionAmount = params.amount;
    }
    if (params.enabled !== undefined) {
      this.distortionEnabled = params.enabled;
    }
    this.updateCurve();
  }

  getParams(): Required<DistortionParams> {
    return {
      type: this.distortionType,
      amount: this.distortionAmount,
      enabled: this.distortionEnabled
    };
  }

  setType(type: DistortionType): void {
    this.distortionType = type;
    this.updateCurve();
  }

  getType(): DistortionType {
    return this.distortionType;
  }

  setAmount(amount: number): void {
    this.distortionAmount = amount;
    this.updateCurve();
  }

  getAmount(): number {
    return this.distortionAmount;
  }

  setEnabled(enabled: boolean): void {
    this.distortionEnabled = enabled;
    this.updateCurve();
  }

  isEnabled(): boolean {
    return this.distortionEnabled;
  }

  disconnect(): void {
    this.waveShaperNode.disconnect();
  }

  private updateCurve(): void {
    if (!this.distortionEnabled) {
      this.waveShaperNode.curve = makeBypassCurve();
      return;
    }

    if (this.distortionType === 'soft') {
      this.waveShaperNode.curve = makeSoftClipCurve(this.distortionAmount);
    } else {
      const threshold = 1.0 - (this.distortionAmount / 100);
      this.waveShaperNode.curve = makeHardClipCurve(threshold);
    }
  }
}

import { makeBypassCurve, makeHardClipCurve, makeSoftClipCurve } from './distortionCurves.js';