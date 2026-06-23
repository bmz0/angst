import { DelayController, DelayParameters } from '../utils/delay.js';
import { ReverbController, ReverbParameters } from '../utils/reverb.js';
import { OverdriveParameters } from '../utils/overdrive.js';
import { RectifierMode, RectifierParameters } from '../utils/rectifier.js';
import { EnvelopeParameters } from '../utils/envelope.js';
import { FilterController, FilterParameters, SupportedFilterType } from '../utils/filter.js';
import { LadderFilterController, LadderFilterParameters } from '../utils/ladder-filter.js';
import { CombFilterController, CombFilterParameters } from '../utils/comb-filter.js';
import { OscillatorType } from '../utils/oscillator.js';
import { LfoController, LfoParameters, LfoTarget } from '../utils/lfo.js';
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
  combFilterEnabled?: boolean;
  combFilterDelayTime?: number;
  combFilterGain?: number;
  combFilterFeedback?: boolean;
  combFilterPostGain?: number;
  combFilterKeyboardTracking?: number;
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
  combFilter?: CombFilterParameters;
  overdrive?: OverdriveParameters;
  rectifier?: RectifierParameters;
  delay?: DelayParameters;
  reverb?: ReverbParameters;
  envelope?: EnvelopeParameters;
  lfo1?: LfoParameters;
  lfo2?: LfoParameters;
  lfo3?: LfoParameters;
}

export class SynthEngine {
  private voiceManager: VoiceManager;
  private filterController: FilterController;
  private ladderFilterController: LadderFilterController;
  private combFilterController: CombFilterController;
  private delayController: DelayController;
  private reverbController: ReverbController;
  private lfoControllers: LfoController[];
  private readonly audioContext: BaseAudioContext;
  private lastNoteId = 0;
  private lfoTargets: (LfoTarget | null)[] = [null, null, null];
  private lfoEnabled: boolean[] = [false, false, false];
  private lfoRetrigger: boolean[] = [true, true, true];
  private delayEnabled: boolean;
  private reverbEnabled: boolean;
  private glideTime: number;

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
    this.delayEnabled = config.delayEnabled ?? false;
    this.reverbEnabled = config.reverbEnabled ?? false;
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

    this.combFilterController = new CombFilterController({
      audioContext: this.audioContext,
      destination: this.filterController.getInput(),
      delayTime: config.combFilterDelayTime ?? 0.001,
      gain: config.combFilterGain ?? -0.7,
      feedback: config.combFilterFeedback ?? false,
      enabled: config.combFilterEnabled ?? false,
      postGain: config.combFilterPostGain ?? 1,
      keyboardTracking: config.combFilterKeyboardTracking ?? 0,
    });

    this.voiceManager = new VoiceManager({
      audioContext: this.audioContext,
      destination: this.combFilterController.getInput(),
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

    this.lfoControllers = [
      new LfoController(this.audioContext),
      new LfoController(this.audioContext),
      new LfoController(this.audioContext),
    ];
  }

  play(frequency: number, at?: number): void {
    this.playNote(frequency, frequency, at);
  }

  playNote(noteId: number, frequency: number, at?: number): void {
    this.lastNoteId = noteId;
    for (let i = 0; i < 3; i++) {
      if (this.lfoRetrigger[i] && this.lfoEnabled[i]) {
        this.lfoControllers[i].retrigger();
      }
    }
    this.voiceManager.play(noteId, frequency, at);
    this.filterController.trackNote(frequency, at, this.glideTime);
    this.ladderFilterController.trackNote(frequency, at, this.glideTime);
    this.combFilterController.trackNote(frequency, at, this.glideTime);
  }

  stop(at?: number): void {
    this.voiceManager.stopAll(at);
  }

  stopNote(noteId: number, at?: number): void {
    this.voiceManager.stop(noteId, at);
    // In mono mode the voice may have slid back to a still-held note.
    // Re-sync all keyboard-tracking filters to that frequency so they don't
    // stay locked to the released note's pitch (the comb/filter artifact).
    const newFrequency = this.voiceManager.getCurrentFrequency();
    if (newFrequency !== undefined) {
      this.filterController.trackNote(newFrequency, at, this.glideTime);
      this.ladderFilterController.trackNote(newFrequency, at, this.glideTime);
      this.combFilterController.trackNote(newFrequency, at, this.glideTime);
    }
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
    if (params.glideTime !== undefined) {
      voiceParams.glideTime = params.glideTime;
      this.glideTime = params.glideTime;
    }
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

    if (params.combFilter !== undefined) {
      this.combFilterController.setParameters(params.combFilter);
    }

    if (params.delay !== undefined) {
      const wasDelayEnabled = this.delayEnabled;
      if (params.delay.enabled !== undefined) this.delayEnabled = params.delay.enabled;
      this.delayController.setParameters(params.delay);
      // Prevent LFO bleed through a disabled bypass.
      if (params.delay.enabled !== undefined) {
        for (let i = 0; i < 3; i++) {
          if (this.lfoEnabled[i] && this.lfoTargets[i] === 'delayMix') {
            if (!this.delayEnabled) {
              this.lfoControllers[i].disconnectFrom(this.delayController.getWetGainParam());
            } else if (!wasDelayEnabled) {
              this.lfoControllers[i].connectTo(this.delayController.getWetGainParam());
            }
          }
        }
      }
    }

    if (params.reverb !== undefined) {
      const wasReverbEnabled = this.reverbEnabled;
      if (params.reverb.enabled !== undefined) this.reverbEnabled = params.reverb.enabled;
      this.reverbController.setParameters(params.reverb);
      if (params.reverb.enabled !== undefined) {
        for (let i = 0; i < 3; i++) {
          if (this.lfoEnabled[i] && this.lfoTargets[i] === 'reverbMix') {
            if (!this.reverbEnabled) {
              this.lfoControllers[i].disconnectFrom(this.reverbController.getWetGainParam());
            } else if (!wasReverbEnabled) {
              this.lfoControllers[i].connectTo(this.reverbController.getWetGainParam());
            }
          }
        }
      }
    }

    // Handle LFO1, LFO2, LFO3 parameters
    this.processLfoParameters(0, params.lfo1);
    this.processLfoParameters(1, params.lfo2);
    this.processLfoParameters(2, params.lfo3);
  }

  setDetune(cents: number): void {
    this.voiceManager.setDetune(cents);
  }

  getLfoElapsedTime(index: number): number {
    if (index < 0 || index >= this.lfoControllers.length) return 0;
    return this.lfoControllers[index].getElapsedTime();
  }

  disconnect(): void {
    this.lfoControllers.forEach(lfo => lfo.disconnect());
    this.voiceManager.disconnect();
    this.filterController.disconnect();
    this.ladderFilterController.disconnect();
    this.combFilterController.disconnect();
    this.delayController.disconnect();
    this.reverbController.disconnect();
  }

  private processLfoParameters(lfoIndex: number, lfoParams?: LfoParameters): void {
    if (lfoParams === undefined) return;

    const lfo = this.lfoControllers[lfoIndex];
    if (lfoParams.fadeIn !== undefined) lfo.setFadeIn(lfoParams.fadeIn);
    if (lfoParams.rate !== undefined) lfo.setRate(lfoParams.rate);
    if (lfoParams.depth !== undefined) lfo.setDepth(lfoParams.depth);
    if (lfoParams.shape !== undefined) lfo.setShape(lfoParams.shape);
    if (lfoParams.retrigger !== undefined) this.lfoRetrigger[lfoIndex] = lfoParams.retrigger;

    // Process target and enabled together so mixed updates are always coherent.
    if (lfoParams.target !== undefined || lfoParams.enabled !== undefined) {
      const wasEnabled = this.lfoEnabled[lfoIndex];
      const newTarget = lfoParams.target ?? this.lfoTargets[lfoIndex] ?? 'filterFrequency';
      const newEnabled = lfoParams.enabled ?? this.lfoEnabled[lfoIndex];

      if (wasEnabled && this.lfoTargets[lfoIndex] !== null) {
        this.disconnectLfoFromTarget(lfoIndex, this.lfoTargets[lfoIndex]!);
      }
      this.lfoTargets[lfoIndex] = newTarget;
      this.lfoEnabled[lfoIndex] = newEnabled;
      if (newEnabled) {
        // Retrigger (with fade-in) when the LFO transitions from disabled → enabled.
        if (!wasEnabled) {
          lfo.retrigger();
        }
        this.connectLfoToTarget(lfoIndex, newTarget);
      }
    }
  }

  private connectLfoToTarget(lfoIndex: number, target: LfoTarget): void {
    const lfo = this.lfoControllers[lfoIndex];
    switch (target) {
      case 'oscMix':      this.voiceManager.setOscMixModulation(lfo.getOutput()); return;
      case 'oscPreGain':  this.voiceManager.setOscPreGainModulation(lfo.getOutput()); return;
      case 'oscPostGain': this.voiceManager.setOscPostGainModulation(lfo.getOutput()); return;
      case 'oscPitch':    this.voiceManager.setPitchModulation(lfo.getOutput()); return;
      case 'lfo1Rate':    lfo.connectTo(this.lfoControllers[0].getRateParam()); return;
      case 'lfo1Depth':   lfo.connectTo(this.lfoControllers[0].getDepthParam()); return;
      case 'lfo2Rate':    lfo.connectTo(this.lfoControllers[1].getRateParam()); return;
      case 'lfo2Depth':   lfo.connectTo(this.lfoControllers[1].getDepthParam()); return;
    }
    const param = this.getLfoAudioParam(target);
    if (param) lfo.connectTo(param);
  }

  private disconnectLfoFromTarget(lfoIndex: number, target: LfoTarget): void {
    const lfo = this.lfoControllers[lfoIndex];
    switch (target) {
      case 'oscMix':      this.voiceManager.setOscMixModulation(null); return;
      case 'oscPreGain':  this.voiceManager.setOscPreGainModulation(null); return;
      case 'oscPostGain': this.voiceManager.setOscPostGainModulation(null); return;
      case 'oscPitch':    this.voiceManager.setPitchModulation(null); return;
      case 'lfo1Rate':    lfo.disconnectFrom(this.lfoControllers[0].getRateParam()); return;
      case 'lfo1Depth':   lfo.disconnectFrom(this.lfoControllers[0].getDepthParam()); return;
      case 'lfo2Rate':    lfo.disconnectFrom(this.lfoControllers[1].getRateParam()); return;
      case 'lfo2Depth':   lfo.disconnectFrom(this.lfoControllers[1].getDepthParam()); return;
    }
    const param = this.getLfoAudioParam(target);
    if (param) lfo.disconnectFrom(param);
  }

  private getLfoAudioParam(target: LfoTarget): AudioParam | null {
    switch (target) {
      case 'filterFrequency':       return this.filterController.getFrequencyParam();
      case 'filterQ':               return this.filterController.getQParam();
      case 'ladderFilterFrequency': return this.ladderFilterController.getCutoffParam();
      case 'ladderFilterResonance': return this.ladderFilterController.getResonanceParam();
      case 'delayMix':   return this.delayEnabled  ? this.delayController.getWetGainParam()  : null;
      case 'reverbMix':  return this.reverbEnabled ? this.reverbController.getWetGainParam() : null;
      default:           return null; // per-voice targets handled in connect/disconnectLfoFromTarget
    }
  }
}