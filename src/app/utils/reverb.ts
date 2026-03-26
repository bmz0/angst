export interface ReverbConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  roomSize: number;
  decay: number;
  mix: number;
  enabled: boolean;
  color: number;
  preDelay: number;
}

export interface ReverbParameters {
  enabled?: boolean;
  roomSize?: number;
  decay?: number;
  mix?: number;
  color?: number;
  preDelay?: number;
}

export class ReverbController {
  private inputNode: GainNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;
  private convolverNode: ConvolverNode;
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

    this.dryGainNode = this.audioContext.createGain();
    this.dryGainNode.gain.value = 1;
    this.wetGainNode = this.audioContext.createGain();

    this.inputNode.connect(this.dryGainNode);
    this.inputNode.connect(this.convolverNode);
    this.convolverNode.connect(this.wetGainNode);
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
    // ~5 ms interaural delay: offsets R channel so stereo channels decorrelate naturally
    const interauralDelay = Math.floor(sampleRate * 0.005);
    // ~50 ms buildup ramp: models sparse early reflections filling into a dense tail
    const buildupSamples = Math.floor(sampleRate * 0.05);
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    const decayRate = Math.exp(-decay / length);
    // Leaky integrator: higher coeff = faster tracking = brighter; lower = darker
    const leakCoeff = 0.5 + color * 0.4;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const tailStart = preDelaySamples + channel * interauralDelay;
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
        const white = Math.random() * 2 - 1;
        prev = prev + (white - prev) * leakCoeff;
        env *= decayRate;
        data[i] = prev * env * density;
      }
    }
    return buffer;
  }

  disconnect(): void {
    this.inputNode.disconnect();
    this.convolverNode.disconnect();
    this.dryGainNode.disconnect();
    this.wetGainNode.disconnect();
  }
}
