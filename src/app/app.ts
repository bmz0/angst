import { Component, afterNextRender, inject, signal } from '@angular/core';
import { AudioContextService } from './services/audio-context.service.js';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('angst');
  protected readonly audioContextService = inject(AudioContextService);

  constructor() {
    afterNextRender(() => {
      this.audioContextService.initialize();
    });
  }

  protected resumeAudioContext(): void {
    this.audioContextService.resume();
  }

  protected get audioContext(): AudioContext | undefined {
    return this.audioContextService.getContext();
  }
}
