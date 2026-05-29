import { Component, viewChild, signal, DestroyRef, inject } from '@angular/core';
import { Keyboard } from '../keyboard/keyboard.js';
import { Visualizer } from '../visualizer/visualizer.js';
import { OscillatorPanel } from '../effects/oscillator-panel/oscillator-panel.js';
import { OverdrivePanel } from '../effects/overdrive-panel/overdrive-panel.js';
import { RectifierPanel } from '../effects/rectifier-panel/rectifier-panel.js';
import { FilterPanel } from '../effects/filter-panel/filter-panel.js';
import { LadderFilterPanel } from '../effects/ladder-filter-panel/ladder-filter-panel.js';
import { EnvelopePanel } from '../effects/envelope-panel/envelope-panel.js';
import { DelayPanel } from '../effects/delay-panel/delay-panel.js';
import { ReverbPanel } from '../effects/reverb-panel/reverb-panel.js';
import { ArpeggiatorPanel } from '../effects/arpeggiator-panel/arpeggiator-panel.js';
import { LfoPanel } from '../effects/lfo-panel/lfo-panel.js';
import { SynthEngineService } from '../services/synth-engine.service.js';
import { MidiService } from '../services/midi.service.js';
import { getFrequency } from '../utils/common.js';
import { DEFAULT_PATCH, synthPatchToEngineConfig } from './synth-patch.js';

@Component({
  selector: 'app-synth',
  imports: [Keyboard, Visualizer, OscillatorPanel, OverdrivePanel, RectifierPanel, FilterPanel, LadderFilterPanel, EnvelopePanel, DelayPanel, ReverbPanel, ArpeggiatorPanel, LfoPanel],
  templateUrl: './synth.html',
  styleUrl: './synth.css',
  standalone: true
})
export class Synth {
  private readonly visualizerRef = viewChild.required(Visualizer);
  private readonly oscillatorPanel = viewChild.required(OscillatorPanel);
  private readonly envelopePanel = viewChild.required(EnvelopePanel);
  private readonly arpeggiatorPanel = viewChild.required(ArpeggiatorPanel);

  private readonly synthEngineService = inject(SynthEngineService);
  private readonly midiService = inject(MidiService);
  private readonly destroyRef = inject(DestroyRef);

  protected currentOctave = signal(4);
  private activeVisualizerTimeout: number | null = null;
  /** Maps key identity (e.g. "C-0") to the frequency that was actually played. */
  private readonly playedNotes = new Map<string, number>();

  constructor() {
    this.init();

    this.midiService.onNoteOn = () => {
      if (this.synthEngineService.isPlaying()) {
        if (this.activeVisualizerTimeout) {
          clearTimeout(this.activeVisualizerTimeout);
          this.activeVisualizerTimeout = null;
        }
        this.visualizerRef().start();
      }
    };

    this.midiService.onNoteOff = () => {
      if (!this.synthEngineService.isPlaying() && !this.activeVisualizerTimeout) {
        const releaseTime = this.envelopePanel().getRelease();
        this.activeVisualizerTimeout = setTimeout(() => {
          this.arpeggiatorPanel().stop();
          this.visualizerRef().stop();
          this.activeVisualizerTimeout = null;
        }, (5 + releaseTime) * 1000);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.midiService.onNoteOn = undefined;
      this.midiService.onNoteOff = undefined;
      if (this.activeVisualizerTimeout) clearTimeout(this.activeVisualizerTimeout);
      this.arpeggiatorPanel().stop();
      this.synthEngineService.disconnect();
    });
  }

  private async init(): Promise<void> {
    await this.synthEngineService.initialize(synthPatchToEngineConfig(DEFAULT_PATCH));
    await this.midiService.initialize();
  }

  protected play(note: string, octaveOffset: number = 0): void {
    const octave = this.currentOctave() + octaveOffset;
    const scientificNotation = `${note}${octave}`;
    const baseFrequency = getFrequency(scientificNotation);

    // Track which frequency this key identity maps to (for correct release)
    const keyId = `${note}-${octaveOffset}`;
    this.playedNotes.set(keyId, baseFrequency);
    
    if (this.arpeggiatorPanel().isEnabled()) {
      this.synthEngineService.playNote(baseFrequency, baseFrequency);
      this.arpeggiatorPanel().start((semitoneOffset) => {
        this.synthEngineService.setArpDetune(semitoneOffset * 100);
      });
    } else {
      this.synthEngineService.playNote(baseFrequency, baseFrequency);
    }

    if (this.synthEngineService.isPlaying()) {
      if (this.activeVisualizerTimeout) {
        clearTimeout(this.activeVisualizerTimeout);
        this.activeVisualizerTimeout = null;
      }
      this.visualizerRef().start();
    }
  }

  protected stop(note?: string, octaveOffset?: number): void {
    const releaseTime = this.envelopePanel().getRelease();

    if (note) {
      const keyId = `${note}-${octaveOffset ?? 0}`;
      const frequency = this.playedNotes.get(keyId);
      this.playedNotes.delete(keyId);
      if (frequency !== undefined) {
        this.synthEngineService.stopNote(frequency);
      }
    } else {
      // Stop all — clear tracked notes
      this.playedNotes.clear();
      this.synthEngineService.stop();
    }

    if (!this.synthEngineService.isPlaying() && !this.activeVisualizerTimeout) {
      this.activeVisualizerTimeout = setTimeout(() => {
        this.arpeggiatorPanel().stop();
        this.visualizerRef().stop();
        this.activeVisualizerTimeout = null;
      }, (5 + releaseTime) * 1000);
    }
  }

  protected onOctaveChanged(octave: number): void {
    this.currentOctave.set(octave);
  }

  protected toggleOscillatorType(): void {
    this.oscillatorPanel().toggleOscillator1Type();
  }

  protected onArpeggiatorStoppedWhilePlaying(): void {
    this.synthEngineService.setArpDetune(0);
  }
}
