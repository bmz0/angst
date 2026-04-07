export interface ReverbConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  roomSize: number;
  decay: number;
  mix: number;
  enabled: boolean;
  color: number;
  preDelay: number;
  hpFrequency: number;
}

export interface ReverbParameters {
  enabled?: boolean;
  roomSize?: number;
  decay?: number;
  mix?: number;
  color?: number;
  preDelay?: number;
  hpFrequency?: number;
}

export class ReverbController {
  private inputNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private convolverNode: ConvolverNode;
  private hpFilterNode: BiquadFilterNode;
  private readonly audioContext: BaseAudioContext;
  private enabled: boolean;
  private mix: number;
  private roomSize: number;
  private decay: number;
  private color: number;
  private preDelay: number;

  constructor(config: ReverbConfig) {
    this.audioContext = config.audioContext;
    this.enabled = config.enabled;
    this.mix = config.mix;
    this.roomSize = config.roomSize;
    this.decay = config.decay;
    this.color = config.color;
    this.preDelay = config.preDelay;

    this.inputNode = this.audioContext.createGain();
    this.inputNode.gain.value = 1;

    this.convolverNode = this.audioContext.createConvolver();
    this.convolverNode.buffer = this.generateImpulseResponse(this.roomSize, this.decay, this.color, this.preDelay);

    this.hpFilterNode = this.audioContext.createBiquadFilter();
    this.hpFilterNode.type = 'highpass';
    this.hpFilterNode.frequency.value = config.hpFrequency;
    this.hpFilterNode.Q.value = 0.5;

    this.dryGainNode = this.audioContext.createGain();
    this.dryGainNode.gain.value = 1;
    this.wetGainNode = this.audioContext.createGain();

    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.convolverNode);
    this.convolverNode.connect(this.hpFilterNode);
    this.hpFilterNode.connect(this.wetGainNode);
    this.dryGainNode.connect(config.destination);
    this.wetGainNode.connect(config.destination);

    this.updateBypass();
  }

  getInput(): GainNode {
    return this.inputNode;
  }

  setParameters(params: ReverbParameters): void {
    const now = this.audioContext.currentTime;
    let shouldUpdateBypass = false;
    let shouldUpdateIR = false;

    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      shouldUpdateBypass = true;
    }

    if (params.mix !== undefined) {
      this.mix = params.mix;
      if (this.enabled) {
        this.wetGainNode.gain.setValueAtTime(this.mix, now);
      }
    }

    if (params.roomSize !== undefined) {
      this.roomSize = params.roomSize;
      shouldUpdateIR = true;
    }

    if (params.decay !== undefined) {
      this.decay = params.decay;
      shouldUpdateIR = true;
    }

    if (params.color !== undefined) {
      this.color = params.color;
      shouldUpdateIR = true;
    }

    if (params.preDelay !== undefined) {
      this.preDelay = params.preDelay;
      shouldUpdateIR = true;
    }

    if (params.hpFrequency !== undefined) {
      this.hpFilterNode.frequency.setValueAtTime(params.hpFrequency, now);
    }

    if (shouldUpdateIR) {
      this.convolverNode.buffer = this.generateImpulseResponse(this.roomSize, this.decay, this.color, this.preDelay);
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

  // color: -1 = dark/warm, 0 = neutral, +1 = bright; preDelay in seconds
  private generateImpulseResponse(duration: number, decay: number, color: number, preDelay: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const preDelaySamples = Math.floor(sampleRate * preDelay);
    // ~50 ms buildup ramp: models sparse early reflections filling into a dense tail
    const buildupSamples = Math.floor(sampleRate * 0.05);
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    const decayRate = Math.exp(-decay / length);
    // Leaky integrator: higher coeff = faster tracking = brighter; lower = darker
    const leakCoeff = 0.5 + color * 0.49;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const tailStart = preDelaySamples + channel * 23; // small prime offset between channels to decorrelate early reflections
      // Initialise env to the correct exponential value at tailStart
      let env = Math.exp(-decay * tailStart / length);
      let prev = 0;
      for (let i = 0; i < tailStart && i < length; i++) {
        data[i] = 0;
      }
      for (let i = tailStart; i < length; i++) {
        const tail = i - tailStart;
        // Density ramp: sqrt curve goes from 0→1 over the first buildupSamples
        const density = tail < buildupSamples ? Math.sqrt(tail / buildupSamples) : 1.0;
        const white = (Math.random() * 2 - 1.25) * density;
        prev = prev + (white - prev) * leakCoeff;
        env *= decayRate;
        data[i] = prev * env * density;
      }

      // All-pass diffusion: two Schroeder stages with prime delay lengths
      // Scrambles phase relationships without altering the amplitude spectrum,
      // breaking up comb-filter patterns that cause metallic coloration.
      // Different primes per channel add further inter-channel decorrelation.
      const apG = 0.6;
      const apDelays = channel === 0 ? [1097, 523] : [1049, 557];
      for (const D of apDelays) {
        const apBuf = new Float32Array(D);
        let apIdx = 0;
        for (let i = 0; i < length; i++) {
          const v = data[i] + apG * apBuf[apIdx];
          data[i] = -apG * v + apBuf[apIdx];
          apBuf[apIdx] = v;
          apIdx = (apIdx + 1) % D;
        }
      }
    }

    // Anti-correlated cross-feed: subtracting a fraction of each channel from
    // the other boosts the "sides" relative to the "mid", widening the image.
    const xfeed = 0.2;
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const l = L[i] - xfeed * R[i];
      const r = R[i] - xfeed * L[i];
      L[i] = l;
      R[i] = r;
    }

    return buffer;
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.convolverNode.disconnect();
    this.hpFilterNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
