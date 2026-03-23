import { makeSoftClipCurve, makeFoldCurve } from './overdriveCurves.js';

export type OverdriveType = 'soft' | 'fold';

export interface OverdriveConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  type: 'soft' | 'fold';
  amount: number;
  enabled: boolean;
}

export interface OverdriveParameters {
  enabled?: boolean;
  type?: 'soft' | 'fold';
  amount?: number;
}

export class OverdriveController {
  static SOFT_CURVE_FN = makeSoftClipCurve;
  static FOLD_CURVE_FN = makeFoldCurve;
  private inputNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private waveShaperNode: WaveShaperNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private type: 'soft' | 'fold';
  private amount: number;

  constructor(config: OverdriveConfig) {
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

  setParameters(params: OverdriveParameters): void {
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
      this.waveShaperNode.curve = OverdriveController.SOFT_CURVE_FN(this.amount);
    } else if (this.type === 'fold') {
      const threshold = 1.0 - (this.amount / 100);
      this.waveShaperNode.curve = OverdriveController.FOLD_CURVE_FN(threshold);
    }
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.waveShaperNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
