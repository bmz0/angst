import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },
  { path: 'synth', loadComponent: () => import('./synth/synth.js').then(m => m.Synth) },
  { path: 'sequencer', loadComponent: () => import('./sequencer/sequencer.js').then(m => m.Sequencer) },
  { path: 'welcome', loadComponent: () => import('./welcome/welcome.js').then(m => m.Welcome) }
];
