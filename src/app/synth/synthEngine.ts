import { DelayController, DelayParameters } from '../utils/delay.js';
import { DistortionController, DistortionParameters } from '../utils/distortion.js';
import { EnvelopeController, EnvelopeParameters } from '../utils/envelope.js';
import { FilterController, FilterParameters } from '../utils/filter.js';
import { OscillatorController, OscillatorType } from '../utils/oscillator.js';

export interface SynthEngineConfig {
  audioContext: AudioContext;
  destination: AudioNode;
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  filterEnabled?: boolean;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  filterQ?: number;
  filterKeyboardTracking?: number;
  distortionEnabled?: boolean;
  distortionAmount?: number;
  distortionFold?: boolean;
  delayEnabled?: boolean;
  delayTime?: number;
  delayFeedback?: number;
  delayMix?: number;
  envelopeAttack?: number;
  envelopeDecay?: number;
  envelopeSustain?: number;
  envelopeRelease?: number;
}

export interface SynthEngineParameters {
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  filter?: FilterParameters;
  distortion?: DistortionParameters;
  delay?: DelayParameters;
  envelope?: EnvelopeParameters;
}

export class SynthEngine {
  private mixerGain: GainNode;
  private oscillator2Gain: GainNode;
  private filterController: FilterController;
  private distortionController: DistortionController;
  private delayController: DelayController;
  private oscillatorController1: OscillatorController;
  private oscillatorController2: OscillatorController;
  private envelopeController: EnvelopeController;
  private readonly audioContext: AudioContext;
  private oscillator2SubOctave: boolean;
  private oscillator2Invert: boolean;
  private oscillator2Amount: number;
  private glideTime: number;

  constructor(config: SynthEngineConfig) {
    this.audioContext = config.audioContext;
    this.oscillator2SubOctave = config.oscillator2SubOctave ?? true;
    this.oscillator2Invert = config.oscillator2Invert ?? false;
    this.oscillator2Amount = config.oscillator2Amount ?? 1;
    this.glideTime = config.glideTime ?? 0;

    this.delayController = new DelayController({
      audioContext: this.audioContext,
      destination: config.destination,
      delayTime: config.delayTime ?? 0.3,
      feedback: config.delayFeedback ?? 0.3,
      mix: config.delayMix ?? 0.3,
      enabled: config.delayEnabled ?? false
    });

    this.envelopeController = new EnvelopeController({
      audioContext: this.audioContext,
      destination: this.delayController.getInput(),
      attack: config.envelopeAttack ?? 0.005,
      decay: config.envelopeDecay ?? 0.1,
      sustain: config.envelopeSustain ?? 0.7,
      release: config.envelopeRelease ?? 0.5
    });

    this.filterController = new FilterController({
      audioContext: this.audioContext,
      destination: this.envelopeController.getInput(),
      type: config.filterType ?? 'lowpass',
      frequency: config.filterFrequency ?? 1000,
      Q: config.filterQ ?? 1,
      enabled: config.filterEnabled ?? false,
      keyboardTracking: config.filterKeyboardTracking ?? 0.5
    });

    this.distortionController = new DistortionController({
      audioContext: this.audioContext,
      destination: this.filterController.getInput(),
      type: config.distortionFold ? 'hard' : 'soft',
      amount: config.distortionAmount ?? 0,
      enabled: config.distortionEnabled ?? false
    });

    this.mixerGain = this.audioContext.createGain();
    this.mixerGain.gain.value = 0.5;
    this.mixerGain.connect(this.distortionController.getInput());

    this.oscillator2Gain = this.audioContext.createGain();
    const invertMultiplier = this.oscillator2Invert ? -1 : 1;
    this.oscillator2Gain.gain.value = this.oscillator2Amount * invertMultiplier;
    this.oscillator2Gain.connect(this.mixerGain);

    this.oscillatorController1 = new OscillatorController({
      audioContext: this.audioContext,
      type: config.oscillator1Type ?? 'sine',
      frequency: 440,
      destination: this.mixerGain
    });

    this.oscillatorController2 = new OscillatorController({
      audioContext: this.audioContext,
      type: config.oscillator2Type ?? 'square',
      frequency: 220,
      destination: this.oscillator2Gain
    });
  }

  play(frequency: number): void {
    const osc2Frequency = this.oscillator2SubOctave ? frequency / 2 : frequency;
    this.oscillatorController1.play({ frequency, glideTime: this.glideTime });
    this.oscillatorController2.play({ frequency: osc2Frequency, glideTime: this.glideTime });
    
    this.filterController.trackNote(frequency);
    this.envelopeController.trigger();
  }

  stop(): void {
    const releaseTime = this.envelopeController.getParams().release;
    this.envelopeController.release();

    this.oscillatorController1.stop(releaseTime * 1000);
    this.oscillatorController2.stop(releaseTime * 1000);
  }

  isPlaying(): boolean {
    return this.oscillatorController1.isPlaying();
  }

  setParameters(params: SynthEngineParameters): void {
    if (params.oscillator1Type !== undefined) {
      this.oscillatorController1.setType(params.oscillator1Type);
    }

    if (params.oscillator2Type !== undefined) {
      this.oscillatorController2.setType(params.oscillator2Type);
    }

    if (params.oscillator2Amount !== undefined || params.oscillator2Invert !== undefined) {
      if (params.oscillator2Amount !== undefined) {
        this.oscillator2Amount = params.oscillator2Amount;
      }
      if (params.oscillator2Invert !== undefined) {
        this.oscillator2Invert = params.oscillator2Invert;
      }

      const now = this.audioContext.currentTime;
      const invertMultiplier = this.oscillator2Invert ? -1 : 1;
      const newMixerGain = 1 - (this.oscillator2Amount / 2);
      this.oscillator2Gain.gain.setValueAtTime(this.oscillator2Amount * invertMultiplier, now);
      this.mixerGain.gain.setValueAtTime(newMixerGain, now);
    }

    if (params.oscillator2SubOctave !== undefined) {
      this.oscillator2SubOctave = params.oscillator2SubOctave;
      const currentFrequency = this.oscillatorController1.getCurrentFrequency() ?? 440;
      const osc2Frequency = this.oscillator2SubOctave ? currentFrequency / 2 : currentFrequency;

      if (this.isPlaying()) {
        const now = this.audioContext.currentTime;
        this.oscillatorController1.restart({frequency: currentFrequency, when: now});
        this.oscillatorController2.restart({frequency: osc2Frequency, when: now});
      }
    }

    if (params.glideTime !== undefined) {
      this.glideTime = params.glideTime;
    }

    if (params.filter !== undefined) {
      this.filterController.setParameters(params.filter);
    }

    if (params.distortion !== undefined) {
      this.distortionController.setParameters(params.distortion);
    }

    if (params.delay !== undefined) {
      this.delayController.setParameters(params.delay);
    }

    if (params.envelope !== undefined) {
      this.envelopeController.setParameters(params.envelope);
    }
  }

  disconnect(): void {
    this.oscillatorController1.disconnect();
    this.oscillatorController2.disconnect();
    this.envelopeController.disconnect();
    this.filterController.disconnect();
    this.distortionController.disconnect();
    this.delayController.disconnect();
    this.oscillator2Gain.disconnect();
    this.mixerGain.disconnect();
  }
}
