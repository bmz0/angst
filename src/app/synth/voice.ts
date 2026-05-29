import { EnvelopeController, EnvelopeParameters } from '../utils/envelope.js';
import { OscillatorController, OscillatorParameters, OscillatorType, PlaybackOptions } from '../utils/oscillator.js';
import { OverdriveController, OverdriveParameters } from '../utils/overdrive.js';
import { RectifierController, RectifierMode, RectifierParameters } from '../utils/rectifier.js';

export interface VoiceConfig {
  audioContext: BaseAudioContext;
  destination: AudioNode;
  voiceGain?: number;
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator1Amount?: number;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  envelopeEnabled?: boolean;
  envelopeAttack?: number;
  envelopeDecay?: number;
  envelopeSustain?: number;
  envelopeRelease?: number;
  overdriveEnabled?: boolean;
  overdriveAmount?: number;
  overdriveFold?: boolean;
  rectifierEnabled?: boolean;
  rectifierMode?: RectifierMode;
  rectifierBias?: number;
}

export class Voice {
  private static readonly STOP_EPSILON = 0.005;

  private readonly audioContext: BaseAudioContext;
  private readonly oscillator1: OscillatorController;
  private readonly oscillator2: OscillatorController;
  private readonly envelope: EnvelopeController;
  private readonly rectifier: RectifierController;
  private readonly overdrive: OverdriveController;
  private readonly outputGain: GainNode;
  private readonly mixerGain: GainNode;
  // Osc mix LFO fan-out nodes. The LFO source connects to oscMixModInput;
  // osc1ModGain (gain=−1) inverts it for osc1, osc2ModGain (±1) respects the
  // oscillator2 invert flag so the crossfade is always correct regardless of phase.
  private readonly oscMixModInput: GainNode;
  private readonly osc1ModGain: GainNode;
  private readonly osc2ModGain: GainNode;
  private currentOscMixSource: AudioNode | null = null;
  private currentOscPreGainSource: AudioNode | null = null;
  private currentOscPostGainSource: AudioNode | null = null;
  private currentPitchModSource: AudioNode | null = null;
  private oscillator2SubOctave: boolean;
  private glideTime: number;
  private noteId: number | null = null;
  private active = false;

  constructor(config: VoiceConfig) {
    this.audioContext = config.audioContext;
    this.oscillator2SubOctave = config.oscillator2SubOctave ?? true;
    this.glideTime = config.glideTime ?? 0;

    // Output gain applies fixed per-voice attenuation (1/maxVoices)
    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = config.voiceGain ?? 1;
    this.outputGain.connect(config.destination);

    this.mixerGain = this.audioContext.createGain();
    this.mixerGain.gain.value = 1;

    this.envelope = new EnvelopeController({
      audioContext: this.audioContext,
      destination: this.outputGain,
      enabled: config.envelopeEnabled ?? true,
      attack: config.envelopeAttack ?? 0.005,
      decay: config.envelopeDecay ?? 0.1,
      sustain: config.envelopeSustain ?? 0.7,
      release: config.envelopeRelease ?? 0.5,
    });

    this.overdrive = new OverdriveController({
      audioContext: this.audioContext,
      destination: this.envelope.getInput(),
      type: config.overdriveFold ? 'fold' : 'soft',
      amount: config.overdriveAmount ?? 0,
      enabled: config.overdriveEnabled ?? false,
    });

    this.rectifier = new RectifierController({
      audioContext: this.audioContext,
      destination: this.overdrive.getInput(),
      mode: config.rectifierMode ?? 'half',
      bias: config.rectifierBias ?? 0,
      enabled: config.rectifierEnabled ?? false,
    });

    this.mixerGain.connect(this.rectifier.getInput());

    this.oscillator1 = new OscillatorController({
      audioContext: this.audioContext,
      destination: this.mixerGain,
      type: config.oscillator1Type ?? 'sine',
      gain: config.oscillator1Amount ?? 1,
      frequency: 440,
    });

    this.oscillator2 = new OscillatorController({
      audioContext: this.audioContext,
      destination: this.mixerGain,
      type: config.oscillator2Type ?? 'square',
      gain: config.oscillator2Amount ?? 1,
      invert: config.oscillator2Invert ?? false,
      frequency: 220,
    });

    // Osc mix LFO fan-out: a single input node fans out to per-osc signed gains,
    // which then add to each oscillator's persistent gain AudioParam.
    this.oscMixModInput = this.audioContext.createGain();
    this.oscMixModInput.gain.value = 1;
    this.osc1ModGain = this.audioContext.createGain();
    this.osc1ModGain.gain.value = -1; // LFO increase → osc1 quieter
    this.osc2ModGain = this.audioContext.createGain();
    // Respect osc2 invert: inverted gain is negative, so subtract to make it louder.
    this.osc2ModGain.gain.value = (config.oscillator2Invert ?? false) ? -1 : 1;
    this.oscMixModInput.connect(this.osc1ModGain);
    this.osc1ModGain.connect(this.oscillator1.getGainParam());
    this.oscMixModInput.connect(this.osc2ModGain);
    this.osc2ModGain.connect(this.oscillator2.getGainParam());
  }

  play(frequency: number, at?: number): void {
    const osc2Frequency = this.oscillator2SubOctave ? frequency / 2 : frequency;
    this.oscillator1.play({ frequency, glideTime: this.glideTime, at });
    this.oscillator2.play({ frequency: osc2Frequency, glideTime: this.glideTime, at });
    this.envelope.trigger(at);
    this.active = true;
  }

  /** Start at sustain level without attack/decay — for recovering a stolen voice
   * that was still held. No glide; jumps to frequency instantly. */
  recover(frequency: number, at?: number): void {
    const osc2Frequency = this.oscillator2SubOctave ? frequency / 2 : frequency;
    this.oscillator1.play({ frequency, glideTime: 0, at });
    this.oscillator2.play({ frequency: osc2Frequency, glideTime: 0, at });
    this.envelope.jumpToSustain(at);
    this.active = true;
  }

  /** Change pitch without retriggering envelope (legato). */
  legato(frequency: number, at?: number): void {
    const osc2Frequency = this.oscillator2SubOctave ? frequency / 2 : frequency;
    this.oscillator1.play({ frequency, glideTime: this.glideTime, at });
    this.oscillator2.play({ frequency: osc2Frequency, glideTime: this.glideTime, at });
  }

  stop(at?: number): void {
    if (!this.active) return;
    this.active = false;

    const releaseTime = this.envelope.getParams().release;
    this.envelope.release(at);

    this.oscillator1.stop(releaseTime + Voice.STOP_EPSILON, at);
    this.oscillator2.stop(releaseTime + Voice.STOP_EPSILON, at);
  }

  /** Interrupt an in-progress release tail with a fast fade.
   * Unlike quickStop(), does not check the active flag — safe to call on releasing voices. */
  interruptRelease(fadeTime: number, at?: number): void {
    this.envelope.releaseWithDuration(fadeTime, at);
  }

  /** Stop with a fast fade instead of the full release time. Used for ghost-voice dismissal. */
  quickStop(fadeTime: number, at?: number): void {
    if (!this.active) return;
    this.active = false;

    this.envelope.releaseWithDuration(fadeTime, at);
    this.oscillator1.stop(fadeTime + Voice.STOP_EPSILON, at);
    this.oscillator2.stop(fadeTime + Voice.STOP_EPSILON, at);
  }

  restart(frequency: number, at?: number): void {
    this.stop(at);
    this.play(frequency, at);
  }

  triggerPitchSweep(startHz: number, endHz: number, duration: number, at?: number): void {
    this.oscillator1.triggerPitchSweep(startHz, endHz, duration, at);
  }

  setDetune(cents: number): void {
    this.oscillator1.setDetune(cents);
    this.oscillator2.setDetune(cents);
  }

  setOscillatorParameters(osc: 1 | 2, params: OscillatorParameters): void {
    if (osc === 1) {
      this.oscillator1.setParameters(params);
    } else {
      this.oscillator2.setParameters(params);
      // Keep osc2ModGain sign in sync with the invert flag so the crossfade LFO
      // always pushes osc2 louder (regardless of phase inversion).
      if (params.invert !== undefined) {
        this.osc2ModGain.gain.value = params.invert ? -1 : 1;
      }
    }
  }

  /** Connect or disconnect an AudioNode source from the osc mix modulation input. */
  setOscMixModulation(source: AudioNode | null): void {
    if (this.currentOscMixSource) {
      try { this.currentOscMixSource.disconnect(this.oscMixModInput); } catch { /* not connected */ }
    }
    this.currentOscMixSource = source;
    if (source) {
      source.connect(this.oscMixModInput);
    }
  }

  /** Modulate the pre-distortion mixer gain (osc1+osc2 combined level before rectifier/overdrive). */
  setOscPreGainModulation(source: AudioNode | null): void {
    if (this.currentOscPreGainSource) {
      try { this.currentOscPreGainSource.disconnect(this.mixerGain.gain); } catch { /* not connected */ }
    }
    this.currentOscPreGainSource = source;
    if (source) source.connect(this.mixerGain.gain);
  }

  /** Modulate the post-distortion output gain (after envelope, before destination). */
  setOscPostGainModulation(source: AudioNode | null): void {
    if (this.currentOscPostGainSource) {
      try { this.currentOscPostGainSource.disconnect(this.outputGain.gain); } catch { /* not connected */ }
    }
    this.currentOscPostGainSource = source;
    if (source) source.connect(this.outputGain.gain);
  }

  /** Modulate oscillator pitch (both osc1 and osc2 detune AudioParams, in cents). */
  setPitchModulation(source: AudioNode | null): void {
    this.currentPitchModSource = source;
    this.oscillator1.setPitchModSource(source);
    this.oscillator2.setPitchModSource(source);
  }

  setEnvelopeParameters(params: EnvelopeParameters): void {
    this.envelope.setParameters(params);
  }

  setRectifierParameters(params: RectifierParameters): void {
    this.rectifier.setParameters(params);
  }

  setOverdriveParameters(params: OverdriveParameters): void {
    this.overdrive.setParameters(params);
  }

  setGlideTime(glideTime: number): void {
    this.glideTime = glideTime;
  }

  setOscillator2SubOctave(subOctave: boolean): void {
    this.oscillator2SubOctave = subOctave;
    if (this.active) {
      const currentFrequency = this.oscillator1.getCurrentFrequency() ?? 440;
      const osc2Frequency = subOctave ? currentFrequency / 2 : currentFrequency;
      const at = this.audioContext.currentTime + 0.001;
      this.oscillator1.restart({ frequency: currentFrequency, at });
      this.oscillator2.restart({ frequency: osc2Frequency, at });
    }
  }

  getEnvelopeParams() {
    return this.envelope.getParams();
  }

  getNoteId(): number | null {
    return this.noteId;
  }

  setNoteId(id: number | null): void {
    this.noteId = id;
  }

  isActive(): boolean {
    return this.active;
  }

  isPlaying(): boolean {
    return this.oscillator1.isPlaying();
  }

  getCurrentFrequency(): number | undefined {
    return this.oscillator1.getCurrentFrequency();
  }

  disconnect(): void {
    this.oscillator1.disconnect();
    this.oscillator2.disconnect();
    this.envelope.disconnect();
    this.rectifier.disconnect();
    this.overdrive.disconnect();
    this.outputGain.disconnect();
    this.mixerGain.disconnect();
    this.oscMixModInput.disconnect();
    this.osc1ModGain.disconnect();
    this.osc2ModGain.disconnect();
  }
}
