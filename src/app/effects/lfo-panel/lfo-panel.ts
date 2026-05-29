import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { OscillatorType } from '../../utils/oscillator.js';
import { LfoTarget } from '../../utils/lfo.js';
import { SynthEngineService } from '../../services/synth-engine.service.js';
import { MidiService } from '../../services/midi.service.js';

interface LfoState {
  enabled: boolean;
  target: LfoTarget;
  rate: number;
  depth: number;
  shape: OscillatorType;
  retrigger: boolean;
  fadeIn: number;
}

interface LfoIndicatorState {
  cursorPercent: number;
  bandLeftPercent: number;
  bandWidthPercent: number;
  currentValueLabel: string;
}

@Component({
  selector: 'lfo-panel',
  templateUrl: './lfo-panel.html',
  styleUrl: './lfo-panel.css',
  standalone: true,
})
export class LfoPanel {
  private readonly synthEngineService = inject(SynthEngineService);
  private readonly midiService = inject(MidiService);
  private readonly destroyRef = inject(DestroyRef);

  // LFO 1 state
  protected lfo1Enabled   = signal(this.synthEngineService.getPatch().lfoEnabled);
  protected lfo1Target    = signal<LfoTarget>(this.synthEngineService.getPatch().lfoTarget);
  protected lfo1Rate      = signal(this.synthEngineService.getPatch().lfoRate);
  protected lfo1Depth     = signal(this.synthEngineService.getPatch().lfoDepth);
  protected lfo1Shape     = signal<OscillatorType>(this.synthEngineService.getPatch().lfoShape);
  protected lfo1Retrigger = signal(this.synthEngineService.getPatch().lfoRetrigger);
  protected lfo1FadeIn    = signal(this.synthEngineService.getPatch().lfoFadeIn);

  // LFO 2 state
  protected lfo2Enabled   = signal(this.synthEngineService.getPatch().lfo2Enabled);
  protected lfo2Target    = signal<LfoTarget>(this.synthEngineService.getPatch().lfo2Target);
  protected lfo2Rate      = signal(this.synthEngineService.getPatch().lfo2Rate);
  protected lfo2Depth     = signal(this.synthEngineService.getPatch().lfo2Depth);
  protected lfo2Shape     = signal<OscillatorType>(this.synthEngineService.getPatch().lfo2Shape);
  protected lfo2Retrigger = signal(this.synthEngineService.getPatch().lfo2Retrigger);
  protected lfo2FadeIn    = signal(this.synthEngineService.getPatch().lfo2FadeIn);

  // LFO 3 state
  protected lfo3Enabled   = signal(this.synthEngineService.getPatch().lfo3Enabled);
  protected lfo3Target    = signal<LfoTarget>(this.synthEngineService.getPatch().lfo3Target);
  protected lfo3Rate      = signal(this.synthEngineService.getPatch().lfo3Rate);
  protected lfo3Depth     = signal(this.synthEngineService.getPatch().lfo3Depth);
  protected lfo3Shape     = signal<OscillatorType>(this.synthEngineService.getPatch().lfo3Shape);
  protected lfo3Retrigger = signal(this.synthEngineService.getPatch().lfo3Retrigger);
  protected lfo3FadeIn    = signal(this.synthEngineService.getPatch().lfo3FadeIn);

  // MIDI CC depth modulation numbers (-1 = disabled)
  protected lfo1DepthCC = signal(this.synthEngineService.getPatch().lfo1DepthCC);
  protected lfo2DepthCC = signal(this.synthEngineService.getPatch().lfo2DepthCC);
  protected lfo3DepthCC = signal(this.synthEngineService.getPatch().lfo3DepthCC);

  // Indicator state for each LFO
  protected readonly lfo1Indicator = signal<LfoIndicatorState>({
    cursorPercent: 50,
    bandLeftPercent: 0,
    bandWidthPercent: 0,
    currentValueLabel: '',
  });

  protected readonly lfo2Indicator = signal<LfoIndicatorState>({
    cursorPercent: 50,
    bandLeftPercent: 0,
    bandWidthPercent: 0,
    currentValueLabel: '',
  });

  protected readonly lfo3Indicator = signal<LfoIndicatorState>({
    cursorPercent: 50,
    bandLeftPercent: 0,
    bandWidthPercent: 0,
    currentValueLabel: '',
  });

  private rafId: number | null = null;

  // LFO 1 targets (audio parameters only)
  protected readonly lfo1Targets: { value: LfoTarget; label: string }[] = [
    { value: 'filterFrequency',       label: 'Filter Freq' },
    { value: 'filterQ',               label: 'Filter Q' },
    { value: 'ladderFilterFrequency', label: 'Ladder Freq' },
    { value: 'ladderFilterResonance', label: 'Ladder Res' },
    { value: 'delayMix',              label: 'Delay Mix' },
    { value: 'reverbMix',             label: 'Reverb Mix' },
    { value: 'oscMix',                label: 'Osc Mix' },
    { value: 'oscPreGain',            label: 'Osc Level (pre-dist)' },
    { value: 'oscPostGain',           label: 'Osc Level (post-dist)' },
    { value: 'oscPitch',              label: 'Osc Pitch' },
  ];

  // LFO 2 targets (audio parameters + LFO1 modulation)
  protected readonly lfo2Targets: { value: LfoTarget; label: string }[] = [
    ...this.lfo1Targets,
    { value: 'lfo1Rate',  label: 'LFO 1 Rate' },
    { value: 'lfo1Depth', label: 'LFO 1 Depth' },
  ];

  // LFO 3 targets (audio parameters + LFO1/LFO2 modulation)
  protected readonly lfo3Targets: { value: LfoTarget; label: string }[] = [
    ...this.lfo1Targets,
    { value: 'lfo1Rate',  label: 'LFO 1 Rate' },
    { value: 'lfo1Depth', label: 'LFO 1 Depth' },
    { value: 'lfo2Rate',  label: 'LFO 2 Rate' },
    { value: 'lfo2Depth', label: 'LFO 2 Depth' },
  ];

  protected readonly lfoShapes: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];

  /** Depth slider max value, keyed by target. */
  protected readonly depthMax: Record<LfoTarget, number> = {
    filterFrequency:       5000,
    filterQ:               20,
    ladderFilterFrequency: 5000,
    ladderFilterResonance: 4,
    delayMix:              1,
    reverbMix:             1,
    oscMix:                1,
    oscPreGain:            1,
    oscPostGain:           1,
    oscPitch:              200,
    lfo1Rate:              10,
    lfo1Depth:             100,
    lfo2Rate:              10,
    lfo2Depth:             100,
  };

  /** Unit label for the depth slider, keyed by target. */
  protected readonly depthUnit: Record<LfoTarget, string> = {
    filterFrequency:       'Hz',
    filterQ:               '',
    ladderFilterFrequency: 'Hz',
    ladderFilterResonance: '',
    delayMix:              '',
    reverbMix:             '',
    oscMix:                '',
    oscPreGain:            '',
    oscPostGain:           '',
    oscPitch:              '\u00a2',
    lfo1Rate:              'Hz',
    lfo1Depth:             '',
    lfo2Rate:              'Hz',
    lfo2Depth:             '',
  };

  constructor() {
    // Start/stop RAF when any LFO is enabled/disabled
    effect(() => {
      if (this.lfo1Enabled() || this.lfo2Enabled() || this.lfo3Enabled()) {
        this.startRaf();
      } else {
        this.stopRaf();
        this.resetIndicator(1);
        this.resetIndicator(2);
        this.resetIndicator(3);
      }
    });

    // MIDI CC → LFO depth: register/unregister handler when CC number changes
    this.registerDepthCcEffect(1, this.lfo1DepthCC, () => this.depthMax[this.lfo1Target()]);
    this.registerDepthCcEffect(2, this.lfo2DepthCC, () => this.depthMax[this.lfo2Target()]);
    this.registerDepthCcEffect(3, this.lfo3DepthCC, () => this.depthMax[this.lfo3Target()]);

    this.destroyRef.onDestroy(() => this.stopRaf());
  }

  // LFO 1 methods
  protected toggleLfo1Enabled(): void {
    this.lfo1Enabled.update(v => !v);
    this.synthEngineService.setParameters({ lfo1: { enabled: this.lfo1Enabled() } });
  }

  protected onLfo1TargetChange(event: Event): void {
    const target = (event.target as HTMLSelectElement).value as LfoTarget;
    this.lfo1Target.set(target);
    const clampedDepth = Math.min(this.lfo1Depth(), this.depthMax[target]);
    this.lfo1Depth.set(clampedDepth);
    this.synthEngineService.setParameters({ lfo1: { target, depth: clampedDepth } });
  }

  protected onLfo1RateChange(rate: number): void {
    this.lfo1Rate.set(rate);
    this.synthEngineService.setParameters({ lfo1: { rate } });
  }

  protected onLfo1DepthChange(depth: number): void {
    this.lfo1Depth.set(depth);
    this.synthEngineService.setParameters({ lfo1: { depth } });
  }

  protected onLfo1ShapeChange(event: Event): void {
    const shape = (event.target as HTMLSelectElement).value as OscillatorType;
    this.lfo1Shape.set(shape);
    this.synthEngineService.setParameters({ lfo1: { shape } });
  }

  protected toggleLfo1Retrigger(): void {
    this.lfo1Retrigger.update(v => !v);
    this.synthEngineService.setParameters({ lfo1: { retrigger: this.lfo1Retrigger() } });
  }

  protected onLfo1FadeInChange(duration: number): void {
    this.lfo1FadeIn.set(duration);
    this.synthEngineService.setParameters({ lfo1: { fadeIn: duration } });
  }

  // LFO 2 methods
  protected toggleLfo2Enabled(): void {
    this.lfo2Enabled.update(v => !v);
    this.synthEngineService.setParameters({ lfo2: { enabled: this.lfo2Enabled() } });
  }

  protected onLfo2TargetChange(event: Event): void {
    const target = (event.target as HTMLSelectElement).value as LfoTarget;
    this.lfo2Target.set(target);
    const clampedDepth = Math.min(this.lfo2Depth(), this.depthMax[target]);
    this.lfo2Depth.set(clampedDepth);
    this.synthEngineService.setParameters({ lfo2: { target, depth: clampedDepth } });
  }

  protected onLfo2RateChange(rate: number): void {
    this.lfo2Rate.set(rate);
    this.synthEngineService.setParameters({ lfo2: { rate } });
  }

  protected onLfo2DepthChange(depth: number): void {
    this.lfo2Depth.set(depth);
    this.synthEngineService.setParameters({ lfo2: { depth } });
  }

  protected onLfo2ShapeChange(event: Event): void {
    const shape = (event.target as HTMLSelectElement).value as OscillatorType;
    this.lfo2Shape.set(shape);
    this.synthEngineService.setParameters({ lfo2: { shape } });
  }

  protected toggleLfo2Retrigger(): void {
    this.lfo2Retrigger.update(v => !v);
    this.synthEngineService.setParameters({ lfo2: { retrigger: this.lfo2Retrigger() } });
  }

  protected onLfo2FadeInChange(duration: number): void {
    this.lfo2FadeIn.set(duration);
    this.synthEngineService.setParameters({ lfo2: { fadeIn: duration } });
  }

  // LFO 3 methods
  protected toggleLfo3Enabled(): void {
    this.lfo3Enabled.update(v => !v);
    this.synthEngineService.setParameters({ lfo3: { enabled: this.lfo3Enabled() } });
  }

  protected onLfo3TargetChange(event: Event): void {
    const target = (event.target as HTMLSelectElement).value as LfoTarget;
    this.lfo3Target.set(target);
    const clampedDepth = Math.min(this.lfo3Depth(), this.depthMax[target]);
    this.lfo3Depth.set(clampedDepth);
    this.synthEngineService.setParameters({ lfo3: { target, depth: clampedDepth } });
  }

  protected onLfo3RateChange(rate: number): void {
    this.lfo3Rate.set(rate);
    this.synthEngineService.setParameters({ lfo3: { rate } });
  }

  protected onLfo3DepthChange(depth: number): void {
    this.lfo3Depth.set(depth);
    this.synthEngineService.setParameters({ lfo3: { depth } });
  }

  protected onLfo3ShapeChange(event: Event): void {
    const shape = (event.target as HTMLSelectElement).value as OscillatorType;
    this.lfo3Shape.set(shape);
    this.synthEngineService.setParameters({ lfo3: { shape } });
  }

  protected toggleLfo3Retrigger(): void {
    this.lfo3Retrigger.update(v => !v);
    this.synthEngineService.setParameters({ lfo3: { retrigger: this.lfo3Retrigger() } });
  }

  protected onLfo3FadeInChange(duration: number): void {
    this.lfo3FadeIn.set(duration);
    this.synthEngineService.setParameters({ lfo3: { fadeIn: duration } });
  }

  protected onLfo1DepthCCChange(cc: number): void {
    this.lfo1DepthCC.set(cc);
  }

  protected onLfo2DepthCCChange(cc: number): void {
    this.lfo2DepthCC.set(cc);
  }

  protected onLfo3DepthCCChange(cc: number): void {
    this.lfo3DepthCC.set(cc);
  }

  /**
   * Registers a reactive MIDI CC → LFO depth effect.
   * When the CC signal changes to a valid number (0–127) the previous handler
   * is cleaned up and a new one is registered. -1 disables CC control.
   */
  private registerDepthCcEffect(
    lfoIndex: 1 | 2 | 3,
    ccSignal: ReturnType<typeof signal<number>>,
    getMax: () => number,
  ): void {
    let cleanup: (() => void) | null = null;
    effect(() => {
      cleanup?.();
      cleanup = null;
      const cc = ccSignal();
      if (cc < 0 || cc > 127) return;
      cleanup = this.midiService.registerCcHandler(cc, (normalized) => {
        const depth = Math.round(normalized * getMax() * 100) / 100;
        if (lfoIndex === 1) {
          this.lfo1Depth.set(depth);
          this.synthEngineService.setParameters({ lfo1: { depth } });
        } else if (lfoIndex === 2) {
          this.lfo2Depth.set(depth);
          this.synthEngineService.setParameters({ lfo2: { depth } });
        } else {
          this.lfo3Depth.set(depth);
          this.synthEngineService.setParameters({ lfo3: { depth } });
        }
      });
      this.destroyRef.onDestroy(() => { cleanup?.(); cleanup = null; });
    });
  }

  private startRaf(): void {
    this.stopRaf();
    const tick = () => {
      if (this.lfo1Enabled()) this.updateIndicator(1);
      if (this.lfo2Enabled()) this.updateIndicator(2);
      if (this.lfo3Enabled()) this.updateIndicator(3);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private resetIndicator(lfoIndex: number): void {
    const resetState: LfoIndicatorState = {
      cursorPercent: 50,
      bandLeftPercent: 0,
      bandWidthPercent: 0,
      currentValueLabel: '',
    };
    if (lfoIndex === 1) this.lfo1Indicator.set(resetState);
    else if (lfoIndex === 2) this.lfo2Indicator.set(resetState);
    else if (lfoIndex === 3) this.lfo3Indicator.set(resetState);
  }

  private updateIndicator(lfoIndex: number): void {
    const state = this.getLfoState(lfoIndex);
    const elapsed = this.synthEngineService.getLfoElapsedTime(lfoIndex - 1); // 0-based index
    const current = this.computeLfoValue(elapsed, state.rate, state.depth, state.shape);
    const max = this.depthMax[state.target];
    const base = this.getBasePatchValue(state.target, lfoIndex);

    const leftVal = Math.max(0, Math.min(max, base - state.depth));
    const rightVal = Math.max(0, Math.min(max, base + state.depth));
    const cursorVal = base + current;

    const bandLeftPercent = leftVal / max * 100;
    const bandWidthPercent = (rightVal - leftVal) / max * 100;
    const cursorPercent = Math.max(0, Math.min(100, cursorVal / max * 100));

    const suffix = this.depthUnit[state.target];
    const decimals = max <= 1 ? 2 : 0;
    const currentValueLabel = cursorVal.toFixed(decimals) + (suffix ? '\u2009' + suffix : '');

    const indicatorState: LfoIndicatorState = {
      cursorPercent,
      bandLeftPercent,
      bandWidthPercent,
      currentValueLabel,
    };

    if (lfoIndex === 1) this.lfo1Indicator.set(indicatorState);
    else if (lfoIndex === 2) this.lfo2Indicator.set(indicatorState);
    else if (lfoIndex === 3) this.lfo3Indicator.set(indicatorState);
  }

  private getLfoState(lfoIndex: number): LfoState {
    if (lfoIndex === 1) {
      return {
        enabled: this.lfo1Enabled(),
        target: this.lfo1Target(),
        rate: this.lfo1Rate(),
        depth: this.lfo1Depth(),
        shape: this.lfo1Shape(),
        retrigger: this.lfo1Retrigger(),
        fadeIn: this.lfo1FadeIn(),
      };
    } else if (lfoIndex === 2) {
      return {
        enabled: this.lfo2Enabled(),
        target: this.lfo2Target(),
        rate: this.lfo2Rate(),
        depth: this.lfo2Depth(),
        shape: this.lfo2Shape(),
        retrigger: this.lfo2Retrigger(),
        fadeIn: this.lfo2FadeIn(),
      };
    } else {
      return {
        enabled: this.lfo3Enabled(),
        target: this.lfo3Target(),
        rate: this.lfo3Rate(),
        depth: this.lfo3Depth(),
        shape: this.lfo3Shape(),
        retrigger: this.lfo3Retrigger(),
        fadeIn: this.lfo3FadeIn(),
      };
    }
  }

  private computeLfoValue(elapsed: number, rate: number, depth: number, shape: OscillatorType): number {
    const phase = rate * elapsed;
    let n: number;
    switch (shape) {
      case 'sine':
        n = Math.sin(2 * Math.PI * phase);
        break;
      case 'triangle': {
        const p = phase % 1;
        n = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
        break;
      }
      case 'square':
        n = Math.sin(2 * Math.PI * phase) >= 0 ? 1 : -1;
        break;
      case 'sawtooth':
        n = 2 * (phase % 1) - 1;
        break;
      default:
        n = 0;
    }
    return depth * n;
  }

  private getBasePatchValue(target: LfoTarget, lfoIndex: number): number {
    const patch = this.synthEngineService.getPatch();
    switch (target) {
      case 'filterFrequency':       return patch.filterFrequency;
      case 'filterQ':               return patch.filterQ;
      case 'ladderFilterFrequency': return patch.ladderFilterFrequency;
      case 'ladderFilterResonance': return patch.ladderFilterResonance;
      case 'delayMix':              return patch.delayMix;
      case 'reverbMix':             return patch.reverbMix;
      case 'oscMix':                return patch.oscillator2Amount;
      case 'oscPreGain':            return 1;
      case 'oscPostGain': {
        const mode = patch.polyphonyMode;
        return mode === 'mono' ? 1 : mode === 'duo' ? 0.5 : 0.25;
      }
      case 'oscPitch':              return 0;
      case 'lfo1Rate':              return patch.lfoRate;
      case 'lfo1Depth':             return patch.lfoDepth;
      case 'lfo2Rate':              return patch.lfo2Rate;
      case 'lfo2Depth':             return patch.lfo2Depth;
    }
  }
}
