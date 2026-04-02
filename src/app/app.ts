import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertComponent } from './shared/alert/alert.component';
import { ConfirmComponent } from './shared/confirm/confirm.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AlertComponent, ConfirmComponent],
  template: `
    <router-outlet></router-outlet>
    <app-alert></app-alert>
    <app-confirm></app-confirm>
  `,
  styleUrl: './app.css'
})
export class App {
  title = 'arquitectura_proyecto';
}