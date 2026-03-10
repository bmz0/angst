import { Component, OnInit, ViewChild, signal, DestroyRef, inject } from '@angular/core';
import { Keyboard } from '../keyboard/keyboard.js';
import { Visualizer } from '../visualizer/visualizer.js';
import { OscillatorPanel } from '../effects/oscillator-panel/oscillator-panel.js';
import { DistortionPanel } from '../effects/distortion-panel/distortion-panel.js';
import { FilterPanel } from '../effects/filter-panel/filter-panel.js';
import { EnvelopePanel } from '../effects/envelope-panel/envelope-panel.js';
import { DelayPanel } from '../effects/delay-panel/delay-panel.js';
import { ArpeggiatorPanel } from '../effects/arpeggiator-panel/arpeggiator-panel.js';
import { SynthEngineService } from '../services/synth-engine.service.js';
import { getFrequency, getFrequencyWithOffset } from '../utils/common.js';
import { AudioContextService } from '../services/audio-context.service.js';

@Component({
  selector: 'app-synth',
  imports: [Keyboard, Visualizer, OscillatorPanel, DistortionPanel, FilterPanel, EnvelopePanel, DelayPanel, ArpeggiatorPanel],
  templateUrl: './synth.html',
  styleUrl: './synth.css',
  standalone: true
})
export class Synth implements OnInit {
  @ViewChild(Visualizer) private visualizerRef!: Visualizer;
  @ViewChild(OscillatorPanel) private oscillatorPanel!: OscillatorPanel;
  @ViewChild(EnvelopePanel) private envelopePanel!: EnvelopePanel;
  @ViewChild(ArpeggiatorPanel) private arpeggiatorPanel!: ArpeggiatorPanel;

  protected readonly audioContext = inject(AudioContextService);
  private readonly synthEngineService = inject(SynthEngineService);
  private readonly destroyRef = inject(DestroyRef);

  protected analyser!: AnalyserNode;
  protected currentOctave = signal(4);
  private activeVisualizerTimeout: number | null = null;
  private currentBaseFrequency?: number;

  ngOnInit(): void {
    this.init();

    this.destroyRef.onDestroy(() => {
      this.arpeggiatorPanel?.stop();
      this.synthEngineService.disconnect();
    });
  }

  private init(): void {
    const ctx = this.audioContext.getContext()!;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(ctx.destination);

    this.synthEngineService.initialize({
      destination: this.analyser,
      oscillator1Type: 'sine',
      oscillator2Type: 'square',
      oscillator2Amount: 1,
      oscillator2SubOctave: true,
      oscillator2Invert: false,
      glideTime: 0,
      filterEnabled: false,
      filterType: 'lowpass',
      filterFrequency: 1000,
      filterQ: 1,
      filterKeyboardTracking: 0.5,
      filterPostGain: 1,
      distortionEnabled: false,
      distortionAmount: 0,
      distortionFold: false,
      delayEnabled: false,
      delayTime: 0.3,
      delayFeedback: 0.3,
      delayMix: 0.3,
      envelopeAttack: 0.005,
      envelopeDecay: 0.1,
      envelopeSustain: 0.7,
      envelopeRelease: 0.5
    });
  }

  protected play(note: string, octaveOffset: number = 0): void {
    const octave = this.currentOctave() + octaveOffset;
    const scientificNotation = `${note}${octave}`;
    const baseFrequency = getFrequency(scientificNotation);
    
    this.currentBaseFrequency = baseFrequency;

    if (this.arpeggiatorPanel?.isEnabled()) {
      this.arpeggiatorPanel.start((semitoneOffset) => {
        this.playFrequency(baseFrequency, semitoneOffset);
      });
    } else {
      this.playFrequency(baseFrequency, 0);
    }

    if (this.synthEngineService.isPlaying() && this.visualizerRef) {
      if (this.activeVisualizerTimeout) {
        clearTimeout(this.activeVisualizerTimeout);
        this.activeVisualizerTimeout = null;
      }
      this.visualizerRef.start();
    }
  }

  private playFrequency(baseFrequency: number, semitoneOffset: number): void {
    const frequency = getFrequencyWithOffset(baseFrequency, semitoneOffset);
    this.synthEngineService.play(frequency);
  }

  protected stop(): void {
    this.arpeggiatorPanel?.stop();
    this.synthEngineService.stop();

    const releaseTime = this.envelopePanel?.getRelease() ?? 0.5;
    this.activeVisualizerTimeout = setTimeout(() => {
      this.visualizerRef?.stop();
      this.activeVisualizerTimeout = null;
    }, (1 + releaseTime) * 1000);
  }

  protected onOctaveChanged(octave: number): void {
    this.currentOctave.set(octave);
  }

  protected toggleOscillatorType(): void {
    this.oscillatorPanel?.toggleOscillator1Type();
  }

  protected onArpeggiatorStoppedWhilePlaying(): void {
    if (this.currentBaseFrequency) {
      this.playFrequency(this.currentBaseFrequency, 0);
    }
  }
}
