import { DelayController, DelayParameters } from '../utils/delay.js';
import { ReverbController, ReverbParameters } from '../utils/reverb.js';
import { OverdriveParameters } from '../utils/overdrive.js';
import { RectifierMode, RectifierParameters } from '../utils/rectifier.js';
import { EnvelopeParameters } from '../utils/envelope.js';
import { FilterController, FilterParameters, SupportedFilterType } from '../utils/filter.js';
import { LadderFilterController, LadderFilterParameters } from '../utils/ladder-filter.js';
import { OscillatorType } from '../utils/oscillator.js';
import { VoiceManager, PolyphonyMode } from './voice-manager.js';

export interface SynthEngineConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  polyphonyMode?: PolyphonyMode;
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
  filterMix?: number;
  ladderFilterEnabled?: boolean;
  ladderFilterFrequency?: number;
  ladderFilterResonance?: number;
  ladderFilterDrive?: number;
  ladderFilterKeyboardTracking?: number;
  ladderFilterPostGain?: number;
  overdriveEnabled?: boolean;
  overdriveAmount?: number;
  overdriveFold?: boolean;
  rectifierEnabled?: boolean;
  rectifierMode?: RectifierMode;
  rectifierBias?: number;
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
  polyphonyMode?: PolyphonyMode;
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator1Amount?: number;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  filter?: FilterParameters;
  ladderFilter?: LadderFilterParameters;
  overdrive?: OverdriveParameters;
  rectifier?: RectifierParameters;
  delay?: DelayParameters;
  reverb?: ReverbParameters;
  envelope?: EnvelopeParameters;
}

export class SynthEngine {
  private voiceManager: VoiceManager;
  private filterController: FilterController;
  private ladderFilterController: LadderFilterController;
  private delayController: DelayController;
  private reverbController: ReverbController;
  private readonly audioContext: BaseAudioContext;
  private lastNoteId = 0;

  /**
   * Loads all AudioWorklet modules required by the engine into the given
   * AudioContext.  Must be awaited before constructing a SynthEngine instance
   * so that worklet processors are registered and ready for instantiation.
   *
   * Call this once from SynthEngineService.initialize() before building the
   * engine.  It is a no-op on OfflineAudioContext (audioWorklet may be absent).
   */
  static async preload(ctx: AudioContext): Promise<void> {
    await ctx.audioWorklet.addModule('ladder-filter.worklet.js');
  }

  constructor(config: SynthEngineConfig) {
    this.audioContext = config.audioContext;

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

    this.ladderFilterController = new LadderFilterController({
      audioContext: this.audioContext,
      destination: this.delayController.getInput(),
      frequency: config.ladderFilterFrequency ?? 2000,
      resonance: config.ladderFilterResonance ?? 1.5,
      drive: config.ladderFilterDrive ?? 1,
      enabled: config.ladderFilterEnabled ?? false,
      keyboardTracking: config.ladderFilterKeyboardTracking ?? 0.38,
      postGain: config.ladderFilterPostGain ?? 1,
    });

    this.filterController = new FilterController({
      audioContext: this.audioContext,
      destination: this.ladderFilterController.getInput(),
      type: config.filterType ?? 'lowpass',
      frequency: config.filterFrequency ?? 1000,
      Q: config.filterQ ?? 1,
      enabled: config.filterEnabled ?? false,
      keyboardTracking: config.filterKeyboardTracking ?? 0.5,
      postGain: config.filterPostGain ?? 1,
      mix: config.filterMix ?? 1,
    });

    this.voiceManager = new VoiceManager({
      audioContext: this.audioContext,
      destination: this.filterController.getInput(),
      polyphonyMode: config.polyphonyMode,
      oscillator1Type: config.oscillator1Type,
      oscillator2Type: config.oscillator2Type,
      oscillator1Amount: config.oscillator1Amount,
      oscillator2Amount: config.oscillator2Amount,
      oscillator2SubOctave: config.oscillator2SubOctave,
      oscillator2Invert: config.oscillator2Invert,
      glideTime: config.glideTime,
      envelopeEnabled: config.envelopeEnabled,
      envelopeAttack: config.envelopeAttack,
      envelopeDecay: config.envelopeDecay,
      envelopeSustain: config.envelopeSustain,
      envelopeRelease: config.envelopeRelease,
      overdriveEnabled: config.overdriveEnabled,
      overdriveAmount: config.overdriveAmount,
      overdriveFold: config.overdriveFold,
      rectifierEnabled: config.rectifierEnabled,
      rectifierMode: config.rectifierMode,
      rectifierBias: config.rectifierBias,
    });
  }

  play(frequency: number, at?: number): void {
    this.playNote(frequency, frequency, at);
  }

  playNote(noteId: number, frequency: number, at?: number): void {
    this.lastNoteId = noteId;
    this.voiceManager.play(noteId, frequency, at);
    this.filterController.trackNote(frequency, at);
    this.ladderFilterController.trackNote(frequency, at);
  }

  stop(at?: number): void {
    this.voiceManager.stopAll(at);
  }

  stopNote(noteId: number, at?: number): void {
    this.voiceManager.stop(noteId, at);
  }

  isPlaying(): boolean {
    return this.voiceManager.isPlaying();
  }

  setParameters(params: SynthEngineParameters): void {
    const voiceParams: import('./voice-manager.js').VoiceManagerParameters = {};

    if (params.polyphonyMode !== undefined) voiceParams.polyphonyMode = params.polyphonyMode;
    if (params.oscillator1Type !== undefined) voiceParams.oscillator1Type = params.oscillator1Type;
    if (params.oscillator2Type !== undefined) voiceParams.oscillator2Type = params.oscillator2Type;
    if (params.oscillator1Amount !== undefined) voiceParams.oscillator1Amount = params.oscillator1Amount;
    if (params.oscillator2Amount !== undefined) voiceParams.oscillator2Amount = params.oscillator2Amount;
    if (params.oscillator2SubOctave !== undefined) voiceParams.oscillator2SubOctave = params.oscillator2SubOctave;
    if (params.oscillator2Invert !== undefined) voiceParams.oscillator2Invert = params.oscillator2Invert;
    if (params.glideTime !== undefined) voiceParams.glideTime = params.glideTime;
    if (params.envelope !== undefined) voiceParams.envelope = params.envelope;
    if (params.overdrive !== undefined) voiceParams.overdrive = params.overdrive;
    if (params.rectifier !== undefined) voiceParams.rectifier = params.rectifier;

    if (Object.keys(voiceParams).length > 0) {
      this.voiceManager.setParameters(voiceParams);
    }

    if (params.filter !== undefined) {
      this.filterController.setParameters(params.filter);
    }

    if (params.ladderFilter !== undefined) {
      this.ladderFilterController.setParameters(params.ladderFilter);
    }

    if (params.delay !== undefined) {
      this.delayController.setParameters(params.delay);
    }

    if (params.reverb !== undefined) {
      this.reverbController.setParameters(params.reverb);
    }
  }

  setDetune(cents: number): void {
    this.voiceManager.setDetune(cents);
  }

  disconnect(): void {
    this.voiceManager.disconnect();
    this.filterController.disconnect();
    this.ladderFilterController.disconnect();
    this.delayController.disconnect();
    this.reverbController.disconnect();
  }
}
