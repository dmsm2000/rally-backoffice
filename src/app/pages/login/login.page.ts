import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Icon } from '../../ui/icon';
import { BTN_GHOST, BTN_PRIMARY } from '../../ui/styles';

@Component({
  selector: 'bo-login-page',
  imports: [FormsModule, Icon],
  templateUrl: './login.page.html'
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly btnPrimary = BTN_PRIMARY;
  protected readonly btnGhost = BTN_GHOST;

  protected readonly adminSql = computed(
    () => `insert into public.admins (user_id)\nselect id from auth.users where email = '${this.auth.email()}';`
  );

  constructor() {
    effect(() => {
      if (this.auth.access() === 'admin') {
        void this.router.navigateByUrl('/');
      }
    });
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(await this.auth.signInWithPassword(this.email().trim(), this.password()));
    this.submitting.set(false);
  }

  protected async recheck(): Promise<void> {
    this.submitting.set(true);
    await this.auth.refreshAccess();
    this.submitting.set(false);
  }

  protected async useAnotherAccount(): Promise<void> {
    await this.auth.signOut();
    this.password.set('');
    this.error.set(null);
  }
}
