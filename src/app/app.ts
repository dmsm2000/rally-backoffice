import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHost } from './ui/confirm-host';
import { ToastHost } from './ui/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmHost, ToastHost],
  template: `
    <router-outlet />
    <bo-confirm-host />
    <bo-toast-host />
  `
})
export class App {}
