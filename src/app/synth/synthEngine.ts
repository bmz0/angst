import { DelayController, DelayParameters } from '../utils/delay.js';
import { ReverbController, ReverbParameters } from '../utils/reverb.js';
import { OverdriveController, OverdriveParameters } from '../utils/overdrive.js';
import { EnvelopeController, EnvelopeParameters } from '../utils/envelope.js';
import { FilterController, FilterParameters, SupportedFilterType } from '../utils/filter.js';
import { OscillatorController, OscillatorType } from '../utils/oscillator.js';

export interface SynthEngineConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator1Amount?: number;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  filterEnabled?: boolean;
  filterType?: SupportedFilterType;
  filterFrequency?: number;
  filterQ?: number;
  filterKeyboardTracking?: number;
  filterPostGain?: number;
  filterEnvelopeEnabled?: boolean;
  filterEnvelopeAttack?: number;
  filterEnvelopeSustain?: number;
  filterEnvelopeRelease?: number;
  filterEnvelopeBaseLevel?: number;
  overdriveEnabled?: boolean;
  overdriveAmount?: number;
  overdriveFold?: boolean;
  delayEnabled?: boolean;
  delayTime?: number;
  delayFeedback?: number;
  delayMix?: number;
  delayPingPong?: boolean;
  delayPan?: number;
  reverbEnabled?: boolean;
  reverbRoomSize?: number;
  reverbDecay?: number;
  reverbMix?: number;
  reverbColor?: number;
  reverbPreDelay?: number;
  reverbHpFrequency?: number;
  envelopeEnabled?: boolean;
  envelopeAttack?: number;
  envelopeDecay?: number;
  envelopeSustain?: number;
  envelopeRelease?: number;
}

export interface SynthEngineParameters {
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator1Amount?: number;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  filter?: FilterParameters;
  overdrive?: OverdriveParameters;
  delay?: DelayParameters;
  reverb?: ReverbParameters;
  envelope?: EnvelopeParameters;
}

export class SynthEngine {
  private mixerGain: GainNode;
  private filterController: FilterController;
  private overdriveController: OverdriveController;
  private delayController: DelayController;
  private reverbController: ReverbController;
  private oscillatorController1: OscillatorController;
  private oscillatorController2: OscillatorController;
  private envelopeController: EnvelopeController;
  private readonly audioContext: BaseAudioContext;
  private oscillator2SubOctave: boolean;
  private oscillator2Invert: boolean;
  private oscillator1Amount: number;
  private oscillator2Amount: number;
  private glideTime: number;

  constructor(config: SynthEngineConfig) {
    this.audioContext = config.audioContext;
    this.oscillator2SubOctave = config.oscillator2SubOctave ?? true;
    this.oscillator2Invert = config.oscillator2Invert ?? false;
    this.oscillator1Amount = config.oscillator1Amount ?? 1;
    this.oscillator2Amount = config.oscillator2Amount ?? 1;
    this.glideTime = config.glideTime ?? 0;

    this.reverbController = new ReverbController({
      audioContext: this.audioContext,
      destination: config.destination,
      roomSize: config.reverbRoomSize ?? 1.5,
      decay: config.reverbDecay ?? 2,
      mix: config.reverbMix ?? 0.3,
      enabled: config.reverbEnabled ?? false,
      color: config.reverbColor ?? 0,
      preDelay: config.reverbPreDelay ?? 0.01,
      hpFrequency: config.reverbHpFrequency ?? 80,
    });

    this.delayController = new DelayController({
      audioContext: this.audioContext,
      destination: this.reverbController.getInput(),
      delayTime: config.delayTime ?? 0.3,
      feedback: config.delayFeedback ?? 0.3,
      mix: config.delayMix ?? 0.3,
      enabled: config.delayEnabled ?? false,
      pingPong: config.delayPingPong ?? true,
      delayPan: config.delayPan ?? 0,
    });

    this.envelopeController = new EnvelopeController({
      audioContext: this.audioContext,
      destination: this.delayController.getInput(),
      enabled: config.envelopeEnabled ?? true,
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
      keyboardTracking: config.filterKeyboardTracking ?? 0.5,
      postGain: config.filterPostGain ?? 1,
      envelopeEnabled: config.filterEnvelopeEnabled ?? false,
      envelopeAttack: config.filterEnvelopeAttack ?? 0.005,
      envelopeSustain: config.filterEnvelopeSustain ?? 0.7,
      envelopeRelease: config.filterEnvelopeRelease ?? 0.5,
      envelopeBaseLevel: config.filterEnvelopeBaseLevel ?? 0,
    });

    this.overdriveController = new OverdriveController({
      audioContext: this.audioContext,
      destination: this.filterController.getInput(),
      type: config.overdriveFold ? 'fold' : 'soft',
      amount: config.overdriveAmount ?? 0,
      enabled: config.overdriveEnabled ?? false
    });

    this.mixerGain = this.audioContext.createGain();
    this.mixerGain.gain.value = 1;
    this.mixerGain.connect(this.overdriveController.getInput());

    this.oscillatorController1 = new OscillatorController({
      audioContext: this.audioContext,
      type: config.oscillator1Type ?? 'sine',
      gain: this.oscillator1Amount,
      frequency: 440,
      destination: this.mixerGain
    });

    this.oscillatorController2 = new OscillatorController({
      audioContext: this.audioContext,
      type: config.oscillator2Type ?? 'square',
      gain: this.oscillator2Amount,
      invert: this.oscillator2Invert,
      frequency: 220,
      destination: this.mixerGain
    });
  }

  play(frequency: number, at?: number): void {
    const osc2Frequency = this.oscillator2SubOctave ? frequency / 2 : frequency;
    this.oscillatorController1.play({ frequency, glideTime: this.glideTime, at });
    this.oscillatorController2.play({ frequency: osc2Frequency, glideTime: this.glideTime, at });
    
    this.filterController.trackNote(frequency, at);
    this.filterController.triggerEnvelope(at);
    this.envelopeController.trigger(at);
  }

  stop(at?: number): void {
    const releaseTime = this.envelopeController.getParams().release;
    this.filterController.releaseEnvelope(at);
    this.envelopeController.release(at);

    // Oscillators must keep running through the full release tail so the
    // envelope fade can render completely. Add a small epsilon (5 ms) to
    // ensure the oscillator is not hard-cut while the gain is still > 0.
    const EPSILON = 0.005;
    this.oscillatorController1.stop(releaseTime + EPSILON, at);
    this.oscillatorController2.stop(releaseTime + EPSILON, at);
  }

  isPlaying(): boolean {
    return this.oscillatorController1.isPlaying();
  }

  setParameters(params: SynthEngineParameters): void {
    if (params.oscillator1Type !== undefined) {
      this.oscillatorController1.setParameters({ type: params.oscillator1Type });
    }

    if (params.oscillator2Type !== undefined) {
      this.oscillatorController2.setParameters({type: params.oscillator2Type});
    }

    if (params.oscillator1Amount !== undefined) {
      this.oscillator1Amount = params.oscillator1Amount;
      this.oscillatorController1.setParameters({ gain: this.oscillator1Amount });
    }

    if (params.oscillator2Amount !== undefined || params.oscillator2Invert !== undefined) {
      if (params.oscillator2Amount !== undefined) {
        this.oscillator2Amount = params.oscillator2Amount;
      }
      if (params.oscillator2Invert !== undefined) {
        this.oscillator2Invert = params.oscillator2Invert;
      }

      this.oscillatorController2.setParameters({ invert: this.oscillator2Invert, gain: this.oscillator2Amount });
    }

    if (params.oscillator2SubOctave !== undefined) {
      this.oscillator2SubOctave = params.oscillator2SubOctave;
      const currentFrequency = this.oscillatorController1.getCurrentFrequency() ?? 440;
      const osc2Frequency = this.oscillator2SubOctave ? currentFrequency / 2 : currentFrequency;

      if (this.isPlaying()) {
        // Use a shared future-dated timestamp so both oscillators stop and restart
        // on the exact same audio-thread sample frame, preserving their phase relationship.
        const at = this.audioContext.currentTime + 0.001;
        this.oscillatorController1.restart({ frequency: currentFrequency, at });
        this.oscillatorController2.restart({ frequency: osc2Frequency, at });
      }
    }

    if (params.glideTime !== undefined) {
      this.glideTime = params.glideTime;
    }

    if (params.filter !== undefined) {
      this.filterController.setParameters(params.filter);
    }

    if (params.overdrive !== undefined) {
      this.overdriveController.setParameters(params.overdrive);
    }

    if (params.delay !== undefined) {
      this.delayController.setParameters(params.delay);
    }

    if (params.reverb !== undefined) {
      this.reverbController.setParameters(params.reverb);
    }

    if (params.envelope !== undefined) {
      this.envelopeController.setParameters(params.envelope);
    }
  }

  setDetune(cents: number): void {
    this.oscillatorController1.setDetune(cents);
    this.oscillatorController2.setDetune(cents);
  }

  disconnect(): void {
    this.oscillatorController1.disconnect();
    this.oscillatorController2.disconnect();
    this.envelopeController.disconnect();
    this.filterController.disconnect();
    this.overdriveController.disconnect();
    this.delayController.disconnect();
    this.reverbController.disconnect();
    this.mixerGain.disconnect();
  }
}
