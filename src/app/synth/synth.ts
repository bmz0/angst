import { Component, OnInit, ViewChild, signal, DestroyRef, inject } from '@angular/core';
import { Keyboard } from '../keyboard/keyboard.js';
import { Visualizer } from '../visualizer/visualizer.js';
import { OscillatorSelector } from '../oscillator-selector/oscillator-selector.js';
import { OscillatorType } from '../utils/oscillator.js';
import { ArpeggiatorController } from '../utils/arpeggiator.js';
import { SynthEngine } from './synthEngine.js';
import { getFrequency, getFrequencyWithOffset } from '../utils/common.js';
import { AudioContextService } from '../services/audio-context.service.js';
import { SupportedFilterType } from '../utils/filter.js';

@Component({
  selector: 'app-synth',
  imports: [Keyboard, Visualizer, OscillatorSelector],
  templateUrl: './synth.html',
  styleUrl: './synth.css',
  standalone: true
})
export class Synth implements OnInit {
  @ViewChild(Visualizer) visualizerRef!: Visualizer;

  protected audioContext = inject(AudioContextService);

  protected analyser!: AnalyserNode;
  protected currentOctave = signal(4);
  protected oscillator1Type = signal<OscillatorType>('sine');
  protected oscillator2Type = signal<OscillatorType>('square');
  protected oscillator2Amount = signal(1);
  protected oscillator2SubOctave = signal(true);
  protected oscillator2Invert = signal(false);
  protected glideTime = signal(0);
  protected filterEnabled = signal(false);
  protected filterType = signal<SupportedFilterType>('lowpass');
  protected filterFrequency = signal(1000);
  protected filterQ = signal(1);
  protected distortionEnabled = signal(false);
  protected distortionAmount = signal(0);
  protected distortionFold = signal(false);
  protected delayEnabled = signal(false);
  protected delayTime = signal(0.3);
  protected delayFeedback = signal(0.3);
  protected delayMix = signal(0.3);
  protected envelopeAttack = signal(0.005);
  protected envelopeDecay = signal(0.1);
  protected envelopeSustain = signal(0.7);
  protected envelopeRelease = signal(0.5);
  protected filterKeyboardTracking = signal(0.5);
  protected arpeggiatorEnabled = signal(false);
  protected arpeggiatorTempo = signal(300);
  protected arpeggiatorPattern = signal('037');
  protected activeVisualizerTimeout: number | null = null;
  protected filterPostGain = signal(1);

  protected readonly filterTypes: SupportedFilterType[] = [
    'lowpass',
    'highpass',
    'bandpass'
  ];

  private synthEngine!: SynthEngine;
  private arpeggiatorController!: ArpeggiatorController;
  private currentBaseFrequency?: number;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.init();

    this.destroyRef.onDestroy(() => {
      this.arpeggiatorController?.stop();
      this.synthEngine?.disconnect();
    });
  }

  private init(): void {
    const ctx = this.audioContext.getContext()!;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(ctx.destination);

    // Create synth engine
    this.synthEngine = new SynthEngine({
      audioContext: ctx,
      destination: this.analyser,
      oscillator1Type: this.oscillator1Type(),
      oscillator2Type: this.oscillator2Type(),
      oscillator2Amount: this.oscillator2Amount(),
      oscillator2SubOctave: this.oscillator2SubOctave(),
      glideTime: this.glideTime(),
      filterEnabled: this.filterEnabled(),
      filterType: this.filterType(),
      filterFrequency: this.filterFrequency(),
      filterQ: this.filterQ(),
      filterKeyboardTracking: this.filterKeyboardTracking(),
      filterPostGain: this.filterPostGain(),
      distortionEnabled: this.distortionEnabled(),
      distortionAmount: this.distortionAmount(),
      distortionFold: this.distortionFold(),
      delayEnabled: this.delayEnabled(),
      delayTime: this.delayTime(),
      delayFeedback: this.delayFeedback(),
      delayMix: this.delayMix(),
      envelopeAttack: this.envelopeAttack(),
      envelopeDecay: this.envelopeDecay(),
      envelopeSustain: this.envelopeSustain(),
      envelopeRelease: this.envelopeRelease()
    });

    // Create arpeggiator
    this.arpeggiatorController = new ArpeggiatorController({
      tempo: this.arpeggiatorTempo(),
      pattern: this.arpeggiatorPattern()
    });
  }

  protected play(note: string, octaveOffset: number = 0): void {
    const octave = this.currentOctave() + octaveOffset;
    const scientificNotation = `${note}${octave}`;
    const baseFrequency = getFrequency(scientificNotation);
    
    this.currentBaseFrequency = baseFrequency;

    if (this.arpeggiatorEnabled()) {
      this.arpeggiatorController.start((semitoneOffset) => {
        this.playFrequency(baseFrequency, semitoneOffset);
      });
    } else {
      this.playFrequency(baseFrequency, 0);
    }

    if (this.synthEngine.isPlaying() && this.visualizerRef) {
      if (this.activeVisualizerTimeout) {
        clearTimeout(this.activeVisualizerTimeout);
        this.activeVisualizerTimeout = null;
      }
      this.visualizerRef.start();
    }
  }

  private playFrequency(baseFrequency: number, semitoneOffset: number): void {
    const frequency = getFrequencyWithOffset(baseFrequency, semitoneOffset);
    this.synthEngine.play(frequency);
  }

  protected stop(): void {
    this.arpeggiatorController.stop();
    this.synthEngine.stop();
    
    this.activeVisualizerTimeout = setTimeout(() => {
      this.visualizerRef?.stop();
      this.activeVisualizerTimeout = null;
    }, (1 + this.envelopeRelease()) * 1000);
  }

  protected onOctaveChanged(octave: number): void {
    this.currentOctave.set(octave);
  }

  protected toggleOscillatorType(): void {
    const types: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    const currentIndex = types.indexOf(this.oscillator1Type());
    const nextType = types[(currentIndex + 1) % types.length];
    this.oscillator1Type.set(nextType);
    this.synthEngine.setParameters({ oscillator1Type: nextType });
  }

  protected onOscillator1TypeSelected(type: OscillatorType): void {
    this.oscillator1Type.set(type);
    this.synthEngine.setParameters({ oscillator1Type: type });
  }

  protected onOscillator2TypeSelected(type: OscillatorType): void {
    this.oscillator2Type.set(type);
    this.synthEngine.setParameters({ oscillator2Type: type });
  }

  protected onGlideTimeChange(time: number): void {
    this.glideTime.set(time);
    this.synthEngine.setParameters({ glideTime: time });
  }

  protected onOscillator2AmountChange(amount: number): void {
    this.oscillator2Amount.set(amount);
    this.synthEngine.setParameters({ oscillator2Amount: amount });
  }

  protected toggleOscillator2SubOctave(): void {
    this.oscillator2SubOctave.update(enabled => !enabled);
    this.synthEngine.setParameters({ oscillator2SubOctave: this.oscillator2SubOctave() });
  }

  protected onOscillator2InvertChange(): void {
    this.oscillator2Invert.update(invert => !invert);
    this.synthEngine.setParameters({ oscillator2Invert: this.oscillator2Invert()});
  }

  protected toggleFilter(): void {
    this.filterEnabled.update(enabled => !enabled);
    this.synthEngine.setParameters({ filter: { enabled: this.filterEnabled() } });
  }

  protected onFilterTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const type = select.value as SupportedFilterType;
    this.filterType.set(type);
    this.synthEngine.setParameters({ filter: { type } });
  }

  protected onFilterFrequencyChange(frequency: number): void {
    this.filterFrequency.set(frequency);
    this.synthEngine.setParameters({ filter: { frequency: this.filterFrequency() } });
  }

  protected onFilterQChange(q: number): void {
    this.filterQ.set(q);
    this.synthEngine.setParameters({ filter: { Q: this.filterQ() } });
  }

  protected onFilterPostGainChange(amount: number): void {
    this.filterPostGain.set(amount);
    this.synthEngine?.setParameters({ filter: { postGain: this.filterPostGain() }});
  }

  protected toggleDistortion(): void {
    this.distortionEnabled.update(enabled => !enabled);
    this.synthEngine.setParameters({ distortion: { enabled: this.distortionEnabled() } });
  }

  protected onDistortionAmountChange(amount: number): void {
    this.distortionAmount.set(amount);
    this.synthEngine.setParameters({ distortion: { amount: this.distortionAmount() } });
  }

  protected toggleDistortionFold(): void {
    this.distortionFold.update(fold => !fold);
    this.synthEngine.setParameters({ 
      distortion: { type: this.distortionFold() ? 'hard' : 'soft' } 
    });
  }

  protected toggleDelay(): void {
    this.delayEnabled.update(enabled => !enabled);
    this.synthEngine.setParameters({ 
      delay: { enabled: this.delayEnabled(), mix: this.delayMix() } 
    });
  }

  protected onDelayTimeChange(time: number): void {
    this.delayTime.set(time);
    this.synthEngine.setParameters({ delay: { delayTime: this.delayTime() } });
  }

  protected onDelayFeedbackChange(feedback: number): void {
    this.delayFeedback.set(feedback);
    this.synthEngine.setParameters({ delay: { feedback: this.delayFeedback() } });
  }

  protected onDelayMixChange(mix: number): void {
    this.delayMix.set(mix);
    this.synthEngine.setParameters({ delay: { mix: this.delayMix() } });
  }

  protected onEnvelopeAttackChange(attack: number): void {
    this.envelopeAttack.set(attack);
    this.synthEngine.setParameters({ envelope: { attack: this.envelopeAttack() } });
  }

  protected onEnvelopeDecayChange(decay: number): void {
    this.envelopeDecay.set(decay);
    this.synthEngine.setParameters({ envelope: { decay: this.envelopeDecay() } });
  }

  protected onEnvelopeSustainChange(sustain: number): void {
    this.envelopeSustain.set(sustain);
    this.synthEngine.setParameters({ envelope: { sustain: this.envelopeSustain() } });
  }

  protected onEnvelopeReleaseChange(release: number): void {
    this.envelopeRelease.set(release);
    this.synthEngine.setParameters({ envelope: { release: this.envelopeRelease() } });
  }

  protected onFilterKeyboardTrackingChange(amount: number): void {
    this.filterKeyboardTracking.set(amount);
    this.synthEngine.setParameters({ filter: { keyboardTracking: this.filterKeyboardTracking() } });
  }

  protected toggleArpeggiator(): void {
    this.arpeggiatorEnabled.update(enabled => !enabled);
    
    if (!this.arpeggiatorEnabled() && this.arpeggiatorController.isRunning()) {
      this.arpeggiatorController.stop();
      if (this.currentBaseFrequency) {
        this.playFrequency(this.currentBaseFrequency, 0);
      }
    }
  }

  protected onArpeggiatorTempoChange(tempo: number): void {
    this.arpeggiatorTempo.set(tempo);
    this.arpeggiatorController.setTempo(tempo);
  }

  protected onArpeggiatorPatternChange(pattern: string): void {
    this.arpeggiatorPattern.set(pattern);
    this.arpeggiatorController.setPattern(pattern);
  }
}
