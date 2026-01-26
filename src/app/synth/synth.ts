import { Component, OnInit, ViewChild, signal, DestroyRef, inject } from '@angular/core';
import { Keyboard } from '../keyboard/keyboard.js';
import { Visualizer } from '../visualizer/visualizer.js';
import { OscillatorSelector } from '../oscillator-selector/oscillator-selector.js';
import { OscillatorController, OscillatorType } from '../utils/oscillator.js';
import { EnvelopeController } from '../utils/envelope.js';
import { DistortionController } from '../utils/distortion.js';
import { DelayController } from '../utils/delay.js';
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
  protected oscillator1Type = signal<OscillatorType>('sine');
  protected oscillator2Type = signal<OscillatorType>('sine');
  protected oscillator2Amount = signal(0);
  protected glideTime = signal(0);
  protected distortionEnabled = signal(false);
  protected distortionAmount = signal(0);
  protected distortionFold = signal(false);
  protected delayEnabled = signal(false);
  protected delayTime = signal(0.3);
  protected delayFeedback = signal(0.3);
  protected delayMix = signal(0.3);

  private mixerGain!: GainNode;
  private oscillator2Gain!: GainNode;
  private distortionController!: DistortionController;
  private delayController!: DelayController;
  private oscillatorController1!: OscillatorController;
  private oscillatorController2!: OscillatorController;
  private envelopeController!: EnvelopeController;
  private releaseTimeoutId?: number;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.init();

    this.destroyRef.onDestroy(() => {
      if (this.releaseTimeoutId !== undefined) {
        clearTimeout(this.releaseTimeoutId);
      }
      this.oscillatorController1?.disconnect();
      this.oscillatorController2?.disconnect();
      this.envelopeController?.disconnect();
      this.distortionController?.disconnect();
      this.delayController?.disconnect();
      this.oscillator2Gain?.disconnect();
      this.mixerGain?.disconnect();
    });
  }

  private init(): void {
    const ctx = this.audioContext.getContext()!;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Create delay (at end of chain before analyser)
    this.delayController = new DelayController({
      audioContext: ctx,
      destination: this.analyser,
      delayTime: 0.3,
      feedback: 0.3,
      mix: 0.3,
      enabled: this.delayEnabled()
    });

    // Create envelope (connects to delay)
    this.envelopeController = new EnvelopeController({
      audioContext: ctx,
      destination: this.delayController.getInput(),
      attack: 0.005,
      decay: 0.1,
      sustain: 0.7,
      release: 0.5
    });

    // Create distortion (connects to envelope)
    this.distortionController = new DistortionController({
      audioContext: ctx,
      destination: this.envelopeController.getInput(),
      type: 'soft',
      amount: 0,
      enabled: false
    });

    // Create mixer gain node
    this.mixerGain = ctx.createGain();
    this.mixerGain.gain.value = 1;
    this.mixerGain.connect(this.distortionController.getInput());

    // Create oscillator 2 gain node
    this.oscillator2Gain = ctx.createGain();
    this.oscillator2Gain.gain.value = this.oscillator2Amount();
    this.oscillator2Gain.connect(this.mixerGain);

    this.analyser.connect(ctx.destination);

    // Create oscillators
    this.oscillatorController1 = new OscillatorController({
      audioContext: ctx,
      type: this.oscillator1Type(),
      frequency: 440,
      destination: this.mixerGain
    });

    this.oscillatorController2 = new OscillatorController({
      audioContext: ctx,
      type: this.oscillator2Type(),
      frequency: 220,
      destination: this.oscillator2Gain
    });
  }

  protected play(note: string, octaveOffset: number = 0): void {
    if (this.releaseTimeoutId !== undefined) {
      clearTimeout(this.releaseTimeoutId);
      this.releaseTimeoutId = undefined;
    }

    const octave = this.currentOctave() + octaveOffset;
    const scientificNotation = `${note}${octave}`;
    const frequency = getFrequency(scientificNotation);

    this.oscillatorController1.play({ frequency, glideTime: this.glideTime() });
    this.oscillatorController2.play({ frequency: frequency / 2, glideTime: this.glideTime() });
    
    this.envelopeController.trigger();

    if (this.oscillatorController1.isPlaying() && this.visualizerRef) {
      this.visualizerRef.start();
    }
  }

  protected stop(): void {
    this.envelopeController.release();
    
    const releaseTime = this.envelopeController.getParams().release;
    this.releaseTimeoutId = window.setTimeout(() => {
      this.oscillatorController1.stop();
      this.oscillatorController2.stop();
      this.visualizerRef?.stop();
      this.releaseTimeoutId = undefined;
    }, releaseTime * 1000);
  }

  protected onOctaveChanged(octave: number): void {
    this.currentOctave.set(octave);
  }

  protected toggleOscillatorType(): void {
    const types: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    const currentIndex = types.indexOf(this.oscillator1Type());
    const nextType = types[(currentIndex + 1) % types.length];
    this.oscillator1Type.set(nextType);
    this.oscillatorController1.setType(nextType);
  }

  protected onOscillator1TypeSelected(type: OscillatorType): void {
    this.oscillator1Type.set(type);
    this.oscillatorController1.setType(type);
  }

  protected onOscillator2TypeSelected(type: OscillatorType): void {
    this.oscillator2Type.set(type);
    this.oscillatorController2.setType(type);
  }

  protected onGlideTimeChange(time: number): void {
    this.glideTime.set(time);
  }

  protected onOscillator2AmountChange(amount: number): void {
    const now = this.audioContext.getContext()!.currentTime;
    const newMixerGain = 1 - (amount / 2);
    this.oscillator2Amount.set(amount);
    this.oscillator2Gain.gain.setValueAtTime(amount, now);
    this.mixerGain.gain.setValueAtTime(newMixerGain, now);
  }

  protected toggleDistortion(): void {
    this.distortionEnabled.update(enabled => !enabled);
    this.distortionController.setEnabled(this.distortionEnabled());
  }

  protected onDistortionAmountChange(amount: number): void {
    this.distortionAmount.set(amount);
    this.distortionController.setAmount(amount);
  }

  protected toggleDistortionFold(): void {
    this.distortionFold.update(fold => !fold);
    this.distortionController.setType(this.distortionFold() ? 'hard' : 'soft');
  }

  protected toggleDelay(): void {
    this.delayEnabled.update(enabled => !enabled);    
    this.delayController.setEnabled(this.delayEnabled());
  }

  protected onDelayTimeChange(time: number): void {
    this.delayTime.set(time);
    this.delayController.setDelayTime(time);
  }

  protected onDelayFeedbackChange(feedback: number): void {
    this.delayFeedback.set(feedback);
    this.delayController.setFeedback(feedback);
  }

  protected onDelayMixChange(mix: number): void {
    this.delayMix.set(mix);
    this.delayController.setMix(mix);
  }
}
