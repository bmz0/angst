import { Component, inject } from '@angular/core';
import { AudioContextService } from '../services/audio-context.service.js';
import { Router } from "@angular/router";

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  standalone: true
})
export class Welcome {
  protected readonly audioContextService = inject(AudioContextService);
  protected readonly router = inject(Router);

  protected initAudioContext(): void {
    this.audioContextService.initialize();
    this.audioContextService.resume();
    this.router.navigate(['synth']);
  }

  protected resumeAudioContext(): void {
    this.audioContextService.resume();
  }
}
