import { Component, OnInit, ViewChild,input, signal, DestroyRef, inject } from '@angular/core';
import { Keyboard } from '../keyboard/keyboard.js';
import { Visualizer } from '../visualizer/visualizer.js';
import { OscillatorSelector } from '../oscillator-selector/oscillator-selector.js';
import { OscillatorController, OscillatorType } from '../utils/oscillator.js';
import { makeDistortionCurve, makeBypassCurve, makeHardClipCurve } from '../utils/distortion.js';
import { getFrequency } from '../utils/common.js';
import { AudioContextService } from '../services/audio-context.service.js';

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
  protected sustainMode = signal(false);
  protected oscillatorType = signal<OscillatorType>('sine');
  protected distortionEnabled = signal(false);
  protected distortionAmount = signal(0);

  private waveShaperNode!: WaveShaperNode;
  private oscillatorController!: OscillatorController;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.init();

    this.destroyRef.onDestroy(() => {
      this.oscillatorController?.disconnect();
    });
  }

  private init(): void {
    const ctx = this.audioContext.getContext()!;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.waveShaperNode = ctx.createWaveShaper();
    this.updateDistortionCurve();
    this.waveShaperNode.connect(this.analyser);

    this.analyser.connect(ctx.destination);

    this.oscillatorController = new OscillatorController({
      audioContext: ctx,
      type: this.oscillatorType(),
      frequency: 440,
      destination: this.waveShaperNode
    });
  }

  protected play(note: string, octaveOffset: number = 0): void {
    const octave = this.currentOctave() + octaveOffset;
    const scientificNotation = `${note}${octave}`;
    const frequency = getFrequency(scientificNotation);

    this.oscillatorController.play({ frequency });

    if (this.oscillatorController.isPlaying() && this.visualizerRef) {
      this.visualizerRef.start();
    }
  }

  protected stop(): void {
    this.oscillatorController.stop();
    this.visualizerRef?.stop();
  }

  protected onOctaveChanged(octave: number): void {
    this.currentOctave.set(octave);
  }

  protected toggleOscillatorType(): void {
    const types: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    const currentIndex = types.indexOf(this.oscillatorType());
    const nextType = types[(currentIndex + 1) % types.length];
    this.oscillatorType.set(nextType);
    this.oscillatorController.setType(nextType);
  }

  protected onOscillatorTypeSelected(type: OscillatorType): void {
    this.oscillatorType.set(type);
    this.oscillatorController.setType(type);
  }

  protected toggleDistortion(): void {
    this.distortionEnabled.update(enabled => !enabled);
    this.updateDistortionCurve();
  }

  protected toggleSustainMode(): void {
    this.sustainMode.update(mode => !mode);
  }

  protected onDistortionAmountChange(amount: number): void {
    this.distortionAmount.set(amount);
    if (this.distortionEnabled()) {
      this.updateDistortionCurve();
    }
  }

  private updateDistortionCurve(): void {
    if (this.distortionEnabled()) {
      const amount = this.distortionAmount();
      // Use hard clip with threshold based on amount (100 = 1.0, 0 = 0.1)
      const threshold = 1.00000 - (amount / 100);
      this.waveShaperNode.curve = makeHardClipCurve(threshold);
    } else {
      this.waveShaperNode.curve = makeBypassCurve();
    }
  }
}

