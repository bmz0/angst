import { EnvelopeParameters } from '../utils/envelope.js';
import { OscillatorParameters, OscillatorType } from '../utils/oscillator.js';
import { OverdriveParameters } from '../utils/overdrive.js';
import { RectifierMode, RectifierParameters } from '../utils/rectifier.js';
import { Voice, VoiceConfig } from './voice.js';

export type PolyphonyMode = 'mono' | 'duo' | 'quad';

const POLYPHONY_CONFIG: Record<PolyphonyMode, { maxVoices: number; voiceGain: number }> = {
  mono: { maxVoices: 1, voiceGain: 1 },
  duo:  { maxVoices: 2, voiceGain: 0.5 },
  quad: { maxVoices: 4, voiceGain: 0.25 },
};

export interface VoiceManagerConfig {
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

export interface VoiceManagerParameters {
  oscillator1Type?: OscillatorType;
  oscillator2Type?: OscillatorType;
  oscillator1Amount?: number;
  oscillator2Amount?: number;
  oscillator2SubOctave?: boolean;
  oscillator2Invert?: boolean;
  glideTime?: number;
  envelope?: EnvelopeParameters;
  overdrive?: OverdriveParameters;
  rectifier?: RectifierParameters;
  polyphonyMode?: PolyphonyMode;
}

const GHOST_FADE = 0.005; // 10 ms fast fade for ghost voices on mono retrigger

export class VoiceManager {
  private readonly audioContext: BaseAudioContext;
  private readonly destination: AudioNode;
  private maxVoices: number;
  private voiceGain: number;
  private readonly voices: Voice[] = [];
  private readonly heldNotes: { noteId: number; frequency: number }[] = [];
  private voiceDefaults: Omit<VoiceConfig, 'audioContext' | 'destination'>;
  private oscMixModSource: AudioNode | null = null;
  private oscPreGainModSource: AudioNode | null = null;
  private oscPostGainModSource: AudioNode | null = null;
  private pitchModSource: AudioNode | null = null;

  constructor(config: VoiceManagerConfig) {
    this.audioContext = config.audioContext;
    this.destination = config.destination;

    const polyConfig = POLYPHONY_CONFIG[config.polyphonyMode ?? 'mono'];
    this.maxVoices = polyConfig.maxVoices;
    this.voiceGain = polyConfig.voiceGain;

    this.voiceDefaults = {
      voiceGain: this.voiceGain,
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
    };
  }

  play(noteId: number, frequency: number, at?: number): void {
    // Track this note as held
    const heldIdx = this.heldNotes.findIndex(n => n.noteId === noteId);
    if (heldIdx >= 0) {
      this.heldNotes[heldIdx].frequency = frequency;
    } else {
      this.heldNotes.push({ noteId, frequency });
    }

    // If this note already has an active voice, update pitch only if it differs —
    // skipping the legato call when frequencies match preserves any in-progress
    // glide ramp that stop() may have already scheduled (e.g. keyboard fallback
    // play() arriving immediately after a mono slide-back).
    const existing = this.voices.find(v => v.getNoteId() === noteId && v.isActive());
    if (existing) {
      if (existing.getCurrentFrequency() !== frequency) {
        existing.legato(frequency, at);
      }
      return;
    }

    // Mono legato: if a note is held, slide the active voice to the new pitch
    // without retriggering the envelope. When the old voice is already releasing
    // (not active), stealVoice below will orphan it so it fades naturally while
    // the new voice attacks — ghost-voice feel without extra machinery.
    if (this.maxVoices === 1) {
      const activeVoice = this.voices.find(v => v.isActive());
      if (activeVoice) {
        activeVoice.setNoteId(noteId);
        activeVoice.legato(frequency, at);
        return;
      }
    }

    // Steal oldest releasing voice if at capacity
    if (this.voices.length >= this.maxVoices) {
      this.stealVoice(at);
    }

    const voice = new Voice({
      audioContext: this.audioContext,
      destination: this.destination,
      ...this.voiceDefaults,
    });
    if (this.oscMixModSource) voice.setOscMixModulation(this.oscMixModSource);
    if (this.oscPreGainModSource) voice.setOscPreGainModulation(this.oscPreGainModSource);
    if (this.oscPostGainModSource) voice.setOscPostGainModulation(this.oscPostGainModSource);
    if (this.pitchModSource) voice.setPitchModulation(this.pitchModSource);
    voice.setNoteId(noteId);
    voice.play(frequency, at);
    this.voices.push(voice);
  }

  stop(noteId: number, at?: number): void {
    // Remove from held notes
    const heldIdx = this.heldNotes.findIndex(n => n.noteId === noteId);
    if (heldIdx >= 0) {
      this.heldNotes.splice(heldIdx, 1);
    }

    const voice = this.voices.find(v => v.getNoteId() === noteId && v.isActive());
    if (!voice) return;

    // Mono legato: if other notes are still held, slide to the last one
    if (this.maxVoices === 1 && this.heldNotes.length > 0) {
      const lastHeld = this.heldNotes[this.heldNotes.length - 1];
      voice.setNoteId(lastHeld.noteId);
      voice.legato(lastHeld.frequency, at);
      return;
    }

    voice.stop(at);
    this.scheduleCleanup(voice, at);

    // Voice recovery: if held notes exist without active voices, assign them
    this.recoverStolenNotes(at);
  }

  stopAll(at?: number): void {
    this.heldNotes.length = 0;
    for (const voice of this.voices) {
      if (voice.isActive()) {
        voice.stop(at);
        this.scheduleCleanup(voice, at);
      }
    }
  }

  isPlaying(): boolean {
    return this.voices.some(v => v.isPlaying());
  }

  getCurrentFrequency(): number | undefined {
    const active = this.voices.find(v => v.isActive());
    return active?.getCurrentFrequency();
  }

  getEnvelopeParams() {
    // Return the defaults (used by engine for release time queries)
    return {
      attack: this.voiceDefaults.envelopeAttack ?? 0.005,
      decay: this.voiceDefaults.envelopeDecay ?? 0.1,
      sustain: this.voiceDefaults.envelopeSustain ?? 0.7,
      release: this.voiceDefaults.envelopeRelease ?? 0.5,
    };
  }

  setDetune(cents: number): void {
    for (const voice of this.voices) {
      voice.setDetune(cents);
    }
  }

  /** Connect or disconnect an AudioNode source from every current voice's osc mix
   * modulation input, and store it so newly-created voices receive it automatically. */
  setOscMixModulation(source: AudioNode | null): void {
    this.oscMixModSource = source;
    for (const voice of this.voices) {
      voice.setOscMixModulation(source);
    }
  }

  setOscPreGainModulation(source: AudioNode | null): void {
    this.oscPreGainModSource = source;
    for (const voice of this.voices) {
      voice.setOscPreGainModulation(source);
    }
  }

  setOscPostGainModulation(source: AudioNode | null): void {
    this.oscPostGainModSource = source;
    for (const voice of this.voices) {
      voice.setOscPostGainModulation(source);
    }
  }

  setPitchModulation(source: AudioNode | null): void {
    this.pitchModSource = source;
    for (const voice of this.voices) {
      voice.setPitchModulation(source);
    }
  }

  setParameters(params: VoiceManagerParameters): void {
    // Handle polyphony mode change — tear down existing voices and update limits
    if (params.polyphonyMode !== undefined) {
      const polyConfig = POLYPHONY_CONFIG[params.polyphonyMode];
      this.maxVoices = polyConfig.maxVoices;
      this.voiceGain = polyConfig.voiceGain;
      this.voiceDefaults.voiceGain = this.voiceGain;

      // Kill all current voices so gain change takes effect cleanly
      for (const voice of this.voices) {
        voice.disconnect();
      }
      this.voices.length = 0;
      this.heldNotes.length = 0;
    }

    // Update defaults for future voices
    if (params.oscillator1Type !== undefined) {
      this.voiceDefaults.oscillator1Type = params.oscillator1Type;
    }
    if (params.oscillator2Type !== undefined) {
      this.voiceDefaults.oscillator2Type = params.oscillator2Type;
    }
    if (params.oscillator1Amount !== undefined) {
      this.voiceDefaults.oscillator1Amount = params.oscillator1Amount;
    }
    if (params.oscillator2Amount !== undefined) {
      this.voiceDefaults.oscillator2Amount = params.oscillator2Amount;
    }
    if (params.oscillator2SubOctave !== undefined) {
      this.voiceDefaults.oscillator2SubOctave = params.oscillator2SubOctave;
    }
    if (params.oscillator2Invert !== undefined) {
      this.voiceDefaults.oscillator2Invert = params.oscillator2Invert;
    }
    if (params.glideTime !== undefined) {
      this.voiceDefaults.glideTime = params.glideTime;
    }
    if (params.envelope !== undefined) {
      if (params.envelope.enabled !== undefined) this.voiceDefaults.envelopeEnabled = params.envelope.enabled;
      if (params.envelope.attack !== undefined) this.voiceDefaults.envelopeAttack = params.envelope.attack;
      if (params.envelope.decay !== undefined) this.voiceDefaults.envelopeDecay = params.envelope.decay;
      if (params.envelope.sustain !== undefined) this.voiceDefaults.envelopeSustain = params.envelope.sustain;
      if (params.envelope.release !== undefined) this.voiceDefaults.envelopeRelease = params.envelope.release;
    }
    if (params.overdrive !== undefined) {
      if (params.overdrive.enabled !== undefined) this.voiceDefaults.overdriveEnabled = params.overdrive.enabled;
      if (params.overdrive.amount !== undefined) this.voiceDefaults.overdriveAmount = params.overdrive.amount;
      if (params.overdrive.type !== undefined) this.voiceDefaults.overdriveFold = params.overdrive.type === 'fold';
    }
    if (params.rectifier !== undefined) {
      if (params.rectifier.enabled !== undefined) this.voiceDefaults.rectifierEnabled = params.rectifier.enabled;
      if (params.rectifier.mode !== undefined) this.voiceDefaults.rectifierMode = params.rectifier.mode;
      if (params.rectifier.bias !== undefined) this.voiceDefaults.rectifierBias = params.rectifier.bias;
    }

    // Propagate to active voices
    for (const voice of this.voices) {
      if (params.oscillator1Type !== undefined) {
        voice.setOscillatorParameters(1, { type: params.oscillator1Type });
      }
      if (params.oscillator2Type !== undefined) {
        voice.setOscillatorParameters(2, { type: params.oscillator2Type });
      }
      if (params.oscillator1Amount !== undefined) {
        voice.setOscillatorParameters(1, { gain: params.oscillator1Amount });
      }
      if (params.oscillator2Amount !== undefined || params.oscillator2Invert !== undefined) {
        voice.setOscillatorParameters(2, {
          gain: params.oscillator2Amount,
          invert: params.oscillator2Invert,
        });
      }
      if (params.oscillator2SubOctave !== undefined) {
        voice.setOscillator2SubOctave(params.oscillator2SubOctave);
      }
      if (params.glideTime !== undefined) {
        voice.setGlideTime(params.glideTime);
      }
      if (params.envelope !== undefined) {
        voice.setEnvelopeParameters(params.envelope);
      }
      if (params.overdrive !== undefined) {
        voice.setOverdriveParameters(params.overdrive);
      }
      if (params.rectifier !== undefined) {
        voice.setRectifierParameters(params.rectifier);
      }
    }
  }

  disconnect(): void {
    for (const voice of this.voices) {
      voice.disconnect();
    }
    this.voices.length = 0;
    this.heldNotes.length = 0;
  }

  private recoverStolenNotes(at?: number): void {
    // Find held notes that don't currently have an active voice
    for (const held of this.heldNotes) {
      const hasVoice = this.voices.some(v => v.getNoteId() === held.noteId && v.isActive());
      if (hasVoice) continue;

      // Check if we have capacity for a new voice
      const activeCount = this.voices.filter(v => v.isActive()).length;
      if (activeCount >= this.maxVoices) break;

      // Steal a releasing voice slot if needed for total voice count
      if (this.voices.length >= this.maxVoices) {
        this.stealVoice(at);
      }

      const voice = new Voice({
        audioContext: this.audioContext,
        destination: this.destination,
        ...this.voiceDefaults,
      });
      voice.setNoteId(held.noteId);
      if (this.oscMixModSource) voice.setOscMixModulation(this.oscMixModSource);
      if (this.oscPreGainModSource) voice.setOscPreGainModulation(this.oscPreGainModSource);
      if (this.oscPostGainModSource) voice.setOscPostGainModulation(this.oscPostGainModSource);
      if (this.pitchModSource) voice.setPitchModulation(this.pitchModSource);
      // Note was already held — resume at sustain level, no attack retrigger.
      voice.recover(held.frequency, at);
      this.voices.push(voice);
    }
  }

  private stealVoice(at?: number): void {
    // Prefer stealing a releasing (inactive) voice first.
    // Fast-fade it so its tail doesn't overlap the new voice (would sound duophonic).
    const releasingIdx = this.voices.findIndex(v => !v.isActive());
    if (releasingIdx >= 0) {
      const releasing = this.voices[releasingIdx];
      releasing.interruptRelease(GHOST_FADE, at);
      this.voices.splice(releasingIdx, 1);
      return;
    }
    // Otherwise steal the oldest active voice with a quick fade to avoid a click.
    const oldest = this.voices.shift();
    if (oldest) {
      oldest.quickStop(GHOST_FADE, at);
      this.scheduleCleanup(oldest, at, GHOST_FADE);
    }
  }

  private scheduleCleanup(voice: Voice, at?: number, releaseOverride?: number): void {
    const release = releaseOverride ?? voice.getEnvelopeParams().release;
    const now = this.audioContext.currentTime;
    const cleanupDelay = at !== undefined
      ? (at - now) + release + 0.05
      : release + 0.05;

    // For offline contexts, don't schedule timeouts — voices are cleaned up on disconnect
    if (typeof setTimeout === 'undefined') return;

    setTimeout(() => {
      // Always disconnect — the voice may have already been removed from
      // this.voices (e.g. ghost-voice that freed its slot early).
      voice.disconnect();
      const idx = this.voices.indexOf(voice);
      if (idx >= 0) this.voices.splice(idx, 1);
    }, Math.max(0, cleanupDelay * 1000));
  }
}
