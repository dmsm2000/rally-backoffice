import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error' | 'warn';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  ok(message: string): void {
    this.push(message, 'ok');
  }

  warn(message: string): void {
    this.push(message, 'warn', 8000);
  }

  error(error: unknown): void {
    this.push(error instanceof Error ? error.message : String(error), 'error', 8000);
  }

  dismiss(id: number): void {
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
  }

  private push(message: string, tone: Toast['tone'], ms = 4000): void {
    const id = this.nextId++;
    this.toasts.update(toasts => [...toasts, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
