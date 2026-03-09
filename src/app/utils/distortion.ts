import { makeSoftClipCurve, makeHardClipCurve } from './distortionCurves.js';

export type DistortionType = 'soft' | 'hard';

export interface DistortionConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  type: 'soft' | 'hard';
  amount: number;
  enabled: boolean;
}

export interface DistortionParameters {
  enabled?: boolean;
  type?: 'soft' | 'hard';
  amount?: number;
}

export class DistortionController {
  static SOFT_CURVE_FN = makeSoftClipCurve;
  static HARD_CURVE_FN = makeHardClipCurve;
  private inputNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private waveShaperNode: WaveShaperNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private type: 'soft' | 'hard';
  private amount: number;

  constructor(config: DistortionConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled;
    this.type = config.type;
    this.amount = config.amount;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.waveShaperNode = this.audioContext.createWaveShaper();
    this.waveShaperNode.oversample = '4x';
    this.updateCurve();

    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.waveShaperNode);
    this.waveShaperNode.connect(this.wetGainNode);
    this.dryGainNode.connect(config.destination);
    this.wetGainNode.connect(config.destination);

    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  setParameters(params: DistortionParameters): void {
    let shouldUpdateBypass = false;
    let shouldUpdateCurve = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.type !== undefined) {
      this.type = params.type;
      shouldUpdateCurve = true;
    }

    if (params.amount !== undefined) {    
      this.amount = params.amount;
      shouldUpdateCurve = true;
    }

    if (shouldUpdateBypass) {
      this.updateBypass();
    }
    if (shouldUpdateCurve) {
      this.updateCurve();
      
    }
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

  private updateCurve(): void {
    if (this.type === 'soft') {
      this.waveShaperNode.curve = DistortionController.SOFT_CURVE_FN(this.amount);
    } else if (this.type === 'hard') {
      const threshold = 1.0 - (this.amount / 100);
      this.waveShaperNode.curve = DistortionController.HARD_CURVE_FN(threshold);
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.waveShaperNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
