import { Component, viewChild, signal, DestroyRef, inject } from '@angular/core';
import { Keyboard } from '../keyboard/keyboard.js';
import { Visualizer } from '../visualizer/visualizer.js';
import { OscillatorPanel } from '../effects/oscillator-panel/oscillator-panel.js';
import { OverdrivePanel } from '../effects/overdrive-panel/overdrive-panel.js';
import { FilterPanel } from '../effects/filter-panel/filter-panel.js';
import { EnvelopePanel } from '../effects/envelope-panel/envelope-panel.js';
import { DelayPanel } from '../effects/delay-panel/delay-panel.js';
import { ArpeggiatorPanel } from '../effects/arpeggiator-panel/arpeggiator-panel.js';
import { SynthEngineService } from '../services/synth-engine.service.js';
import { getFrequency } from '../utils/common.js';
import { DEFAULT_PATCH, synthPatchToEngineConfig } from './synth-patch.js';

@Component({
  selector: 'app-synth',
  imports: [Keyboard, Visualizer, OscillatorPanel, OverdrivePanel, FilterPanel, EnvelopePanel, DelayPanel, ArpeggiatorPanel],
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
  private readonly destroyRef = inject(DestroyRef);

  protected currentOctave = signal(4);
  private activeVisualizerTimeout: number | null = null;

  constructor() {
    this.init();

    this.destroyRef.onDestroy(() => {
      if (this.activeVisualizerTimeout) clearTimeout(this.activeVisualizerTimeout);
      this.arpeggiatorPanel().stop();
      this.synthEngineService.disconnect();
    });
  }

  private init(): void {
    this.synthEngineService.initialize(synthPatchToEngineConfig(DEFAULT_PATCH));
  }

  protected play(note: string, octaveOffset: number = 0): void {
    const octave = this.currentOctave() + octaveOffset;
    const scientificNotation = `${note}${octave}`;
    const baseFrequency = getFrequency(scientificNotation);
    
    if (this.arpeggiatorPanel().isEnabled()) {
      this.synthEngineService.play(baseFrequency);
      this.arpeggiatorPanel().start((semitoneOffset) => {
        this.synthEngineService.setDetune(semitoneOffset * 100);
      });
    } else {
      this.synthEngineService.play(baseFrequency);
    }

    if (this.synthEngineService.isPlaying()) {
      if (this.activeVisualizerTimeout) {
        clearTimeout(this.activeVisualizerTimeout);
        this.activeVisualizerTimeout = null;
      }
      this.visualizerRef().start();
    }
  }

  protected stop(): void {
    const releaseTime = this.envelopePanel().getRelease();

    this.synthEngineService.stop();
    this.activeVisualizerTimeout = setTimeout(() => {
      this.arpeggiatorPanel().stop();
      this.visualizerRef().stop();
      this.activeVisualizerTimeout = null;
    }, (5 + releaseTime) * 1000);
  }

  protected onOctaveChanged(octave: number): void {
    this.currentOctave.set(octave);
  }

  protected toggleOscillatorType(): void {
    this.oscillatorPanel().toggleOscillator1Type();
  }

  protected onArpeggiatorStoppedWhilePlaying(): void {
    this.synthEngineService.setDetune(0);
  }
}
