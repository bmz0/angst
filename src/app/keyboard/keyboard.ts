import { Component, Output, EventEmitter, Input, HostListener } from '@angular/core';

export interface NoteEvent {
  note: string;
  octaveOffset?: number;
}

interface KeyboardAction {
  stop?: boolean;
  toggleOscillatorType?: boolean;
  incrementOctave?: boolean;
  decrementOctave?: boolean;
  note?: string;
  octaveOffset?: number;
}

@Component({
  selector: 'piano-keyboard',
  templateUrl: './keyboard.html',
  styleUrls: ['./keyboard.css'],
  standalone: true
})
export class Keyboard {
  @Input() currentOctave = 4;
  @Output() notePressed = new EventEmitter<NoteEvent>();
  @Output() noteReleased = new EventEmitter<void>();
  @Output() octaveChanged = new EventEmitter<number>();
  @Output() oscillatorTypeToggled = new EventEmitter<void>();

  protected activeNote?: string;

  private readonly keyMap: Record<string, string> = {
    'KeyA': 'C',
    'KeyW': 'C#',
    'KeyS': 'D',
    'KeyE': 'D#',
    'KeyD': 'E',
    'KeyF': 'F',
    'KeyT': 'F#',
    'KeyG': 'G',
    'KeyY': 'G#',
    'KeyH': 'A',
    'KeyU': 'A#',
    'KeyJ': 'B',
    'KeyK': 'C'
  };

  @HostListener('window:keydown', ['$event'])
  protected handleKeyDown(event: KeyboardEvent): void {
    const action = this.parseKeyEvent(event);
    
    if (!action) return;
    
    event.preventDefault();
    this.executeAction(action);
  }

  private parseKeyEvent(event: KeyboardEvent): KeyboardAction | null {
    if (event.code === 'Escape' || event.code === 'Space') {
      return { stop: true };
    }

    if (event.code === 'KeyO') {
      return { toggleOscillatorType: true };
    }

    if (event.code === 'Comma') {
      return { decrementOctave: true };
    }

    if (event.code === 'Period') {
      return { incrementOctave: true };
    }

    const note = this.keyMap[event.code];
    if (note) {
      const octaveOffset = note === 'C' && event.code === 'KeyK' ? 1 : 0;
      return { note, octaveOffset };
    }

    return null;
  }

  private executeAction(action: KeyboardAction): void {
    if (action.stop) {
      this.stop();
    } else if (action.toggleOscillatorType) {
      this.oscillatorTypeToggled.emit();
    } else if (action.incrementOctave) {
      this.incrementOctave();
    } else if (action.decrementOctave) {
      this.decrementOctave();
    } else if (action.note) {
      this.playNote(action.note, action.octaveOffset);
    }
  }

  protected playNote(note: string, octaveOffset: number = 0): void {
    const noteKey = octaveOffset === 1 ? `${note}-high` : note;
    this.activeNote = noteKey;
    this.notePressed.emit({ note, octaveOffset });
  }

  protected stop(): void {
    this.activeNote = undefined;
    this.noteReleased.emit();
  }

  protected isActive(note: string, octaveOffset: number = 0): boolean {
    const noteKey = octaveOffset === 1 ? `${note}-high` : note;
    return this.activeNote === noteKey;
  }

  private incrementOctave(): void {
    if (this.currentOctave < 9) {
      this.currentOctave++;
      this.octaveChanged.emit(this.currentOctave);
    }
  }

  private decrementOctave(): void {
    if (this.currentOctave > 0) {
      this.currentOctave--;
      this.octaveChanged.emit(this.currentOctave);
    }
  }
}
