import { Injectable, inject, signal } from '@angular/core';
import { SynthEngineService } from './synth-engine.service.js';
import { A4_FREQUENCY } from '../utils/common.js';

export type MidiStatus = 'idle' | 'granted' | 'denied' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class MidiService {
  private readonly synthEngineService = inject(SynthEngineService);
  private readonly ccHandlers = new Map<number, Set<(normalizedValue: number) => void>>();
  private midiAccess?: MIDIAccess;

  /** Reactive status of the MIDI permission/connection. */
  readonly status = signal<MidiStatus>('idle');

  /**
   * Pitch bend range in semitones (default: 2, matching the GM standard).
   * Raise this if your MIDI controller or patch is configured for a wider range.
   */
  pitchBendRange = 2;

  /**
   * Called after a MIDI Note On is sent to the engine.
   * Use this to drive visuals or any other side-effects in the host component.
   */
  onNoteOn?: (noteNumber: number, velocity: number) => void;

  /**
   * Called after a MIDI Note Off is sent to the engine.
   */
  onNoteOff?: (noteNumber: number) => void;

  /**
   * Requests MIDI access and begins listening for messages on all connected
   * inputs. Automatically re-attaches listeners when devices are hot-plugged.
   * Safe to call multiple times (re-initializes on each call).
   */
  async initialize(): Promise<MidiStatus> {
    if (!navigator.requestMIDIAccess) {
      this.status.set('unavailable');
      return 'unavailable';
    }

    try {
      if (this.midiAccess) {
        this.midiAccess.onstatechange = null;
      }
      this.midiAccess = await navigator.requestMIDIAccess();
      this.status.set('granted');
      await this.attachListeners(this.midiAccess);
      this.midiAccess.onstatechange = async (e: Event) => {
        const port = (e as MIDIConnectionEvent).port;
        if (port?.state === 'disconnected') {
          this.synthEngineService.stop();
          this.synthEngineService.setPitchBendDetune(0);
        } else {
          await this.attachListeners(this.midiAccess!);
        }
      };
      return 'granted';
    } catch {
      this.status.set('denied');
      return 'denied';
    }
  }

  /**
   * Registers a handler for a specific MIDI CC number.
   * `normalizedValue` is in the range [0, 1] (CC value / 127).
   *
   * Returns a cleanup function that unregisters the handler — call it in
   * `ngOnDestroy` or a `DestroyRef` callback.
   *
   * Example (in any panel):
   * ```ts
   * private readonly cleanup = this.midiService.registerCcHandler(74, (v) => {
   *   const freq = 20 + v * 18000;
   *   this.filterFrequency.set(freq);
   *   this.synthEngineService.setParameters({ filter: { frequency: freq } });
   * });
   * // ngOnDestroy: this.cleanup();
   * ```
   */
  registerCcHandler(ccNumber: number, handler: (normalizedValue: number) => void): () => void {
    if (!this.ccHandlers.has(ccNumber)) {
      this.ccHandlers.set(ccNumber, new Set());
    }
    this.ccHandlers.get(ccNumber)!.add(handler);
    return () => this.ccHandlers.get(ccNumber)?.delete(handler);
  }

  private async attachListeners(midiAccess: MIDIAccess): Promise<void> {
    for (const input of midiAccess.inputs.values()) {
      await input.open();
      input.onmidimessage = (event) => this.handleMidiMessage(event as MIDIMessageEvent);
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data || event.data.length < 3) return;
    const status = event.data[0];
    const data1 = event.data[1];
    const data2 = event.data[2];
    const type = status & 0xf0;

    if (type === 0x90 && data2 > 0) {
      // Note On
      const frequency = A4_FREQUENCY * Math.pow(2, (data1 - 69) / 12);
      this.synthEngineService.playNote(data1, frequency);
      this.onNoteOn?.(data1, data2);
    } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
      // Note Off (explicit, or Note On with velocity 0)
      this.synthEngineService.stopNote(data1);
      this.onNoteOff?.(data1);
    } else if (type === 0xe0) {
      // Pitch Bend: 14-bit value, LSB in data1, MSB in data2; centre = 8192
      const raw = (data2 << 7) | data1;
      const cents = ((raw - 8192) / 8192) * this.pitchBendRange * 100;
      this.synthEngineService.setPitchBendDetune(cents);
    } else if (type === 0xb0) {
      // Control Change
      const handlers = this.ccHandlers.get(data1);
      if (handlers) {
        const normalized = data2 / 127;
        for (const handler of handlers) {
          handler(normalized);
        }
      }
    }
  }
}
