export type RectifierMode = 'half' | 'full';

export interface RectifierConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  mode: RectifierMode;
  /** Bias shifts the clipping threshold in the range [-1, 1].
   *  0 = standard rectification, positive = more aggressive, negative = more signal passes through. */
  bias: number;
  enabled: boolean;
}

export interface RectifierParameters {
  enabled?: boolean;
  mode?: RectifierMode;
  bias?: number;
}

function buildCurve(mode: RectifierMode, bias: number, samples = 4096): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
  const clampedBias = Math.max(-1, Math.min(1, bias));
  let maxValue = 0;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1; // maps [-1, 1]
    if (mode === 'full') {
      curve[i] = Math.abs(x - clampedBias);
    } else {
      // half-wave: pass only the portion above the bias threshold
      curve[i] = Math.max(0, x - clampedBias);
    }

    maxValue = Math.max(maxValue, Math.abs(curve[i]));
  }

  // Normalize to prevent level loss
  const normalizationFactor = maxValue !== 0 ? 1.0 / maxValue : 1.0;
  for (let i = 0; i < samples; i++) {
    curve[i] *= normalizationFactor;
  }

  return curve;
}

export class RectifierController {
  private readonly audioContext: BaseAudioContext;
  private inputNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private waveShaperNode: WaveShaperNode;
  private dcBlocker: BiquadFilterNode;
  private enabled: boolean;
  private mode: RectifierMode;
  private bias: number;

  constructor(config: RectifierConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled;
    this.mode = config.mode;
    this.bias = config.bias;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.waveShaperNode = this.audioContext.createWaveShaper();
    this.waveShaperNode.oversample = '4x';

    // DC blocker removes the offset introduced by asymmetric rectification.
    this.dcBlocker = this.audioContext.createBiquadFilter();
    this.dcBlocker.type = 'highpass';
    this.dcBlocker.frequency.value = 20;
    this.dcBlocker.Q.value = 0.5;

    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    // dry path: input → dry gain → destination
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(config.destination);

    // wet path: input → waveshaper → dc blocker → wet gain → destination
    this.inputNode.connect(this.waveShaperNode);
    this.waveShaperNode.connect(this.dcBlocker);
    this.dcBlocker.connect(this.wetGainNode);
    this.wetGainNode.connect(config.destination);

    this.updateCurve();
    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  setParameters(params: RectifierParameters): void {
    let shouldUpdateBypass = false;
    let shouldUpdateCurve = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.mode !== undefined) {
      this.mode = params.mode;
      shouldUpdateCurve = true;
    }

    if (params.bias !== undefined) {
      this.bias = params.bias;
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
    this.waveShaperNode.curve = buildCurve(this.mode, this.bias);
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.waveShaperNode.disconnect();
    this.dcBlocker.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
