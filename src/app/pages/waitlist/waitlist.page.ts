import { Component, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../core/admin-api';
import { LOCALES, formatDateTime, options, timeAgo } from '../../core/format';
import { WaitlistRow } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Dialog } from '../../ui/dialog';
import { Icon } from '../../ui/icon';
import { Pager, SearchBox } from '../../ui/list-controls';
import { PageHeader } from '../../ui/page-header';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import { BTN_GHOST, BTN_PRIMARY, CARD, INPUT, LABEL } from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

const LIMIT = 100;
const EXPORT_LIMIT = 10000;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function csvCell(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

@Component({
  selector: 'bo-waitlist-page',
  imports: [Icon, Dialog, PageHeader, SearchBox, Pager, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './waitlist.page.html'
})
export class WaitlistPage {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly search = signal('');
  protected readonly offset = signal(0);
  protected readonly rows = signal<WaitlistRow[] | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly adding = signal<{ email: string; locale: string } | null>(null);

  protected readonly limit = LIMIT;
  protected readonly locales = LOCALES;
  protected readonly localeOptions = options(LOCALES);
  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly styles = { card: CARD, ghost: BTN_GHOST, primary: BTN_PRIMARY, input: INPUT, label: LABEL };

  private requestId = 0;

  constructor() {
    effect(() => {
      const request = { search: this.search(), offset: this.offset() };
      untracked(() => void this.load(request.search, request.offset));
    });
  }

  protected setSearch(value: string): void {
    this.offset.set(0);
    this.search.set(value);
  }

  protected validEmail(email: string): boolean {
    return EMAIL.test(email.trim());
  }

  protected async reload(): Promise<void> {
    await this.load(this.search(), this.offset());
  }

  protected async add(): Promise<void> {
    const draft = this.adding();
    if (!draft || !this.validEmail(draft.email) || this.busy()) {
      return;
    }
    this.busy.set('add');
    try {
      const added = await this.api.addToWaitlist(draft.email.trim(), draft.locale);
      if (added) {
        this.toast.ok('Email adicionado.');
        this.adding.set(null);
        void this.store.refresh();
        this.offset.set(0);
        await this.reload();
      } else {
        this.toast.warn('Esse email já estava na lista.');
      }
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(row: WaitlistRow): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Remover da lista de espera?',
      message: `${row.email} deixa de receber o aviso do lançamento.`,
      confirmLabel: 'Remover',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(row.id);
    try {
      await this.api.deleteFromWaitlist(row.id);
      this.toast.ok('Email removido.');
      void this.store.refresh();
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async exportCsv(): Promise<void> {
    this.busy.set('export');
    try {
      const { rows } = await this.api.waitlist('', EXPORT_LIMIT, 0);
      const lines = ['email,idioma,data', ...rows.map(row => [row.email, row.locale, row.created_at].map(csvCell).join(','))];
      const blob = new Blob([`﻿${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rally-lista-de-espera-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.ok(`${rows.length} ${rows.length === 1 ? 'email exportado' : 'emails exportados'}.`);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(search: string, offset: number): Promise<void> {
    const id = ++this.requestId;
    this.rows.set(null);
    this.error.set(null);
    try {
      const result = await this.api.waitlist(search, LIMIT, offset);
      if (id === this.requestId) {
        this.rows.set(result.rows);
        this.total.set(result.total);
      }
    } catch (error) {
      if (id === this.requestId) {
        this.error.set(error instanceof Error ? error.message : String(error));
      }
    }
  }
}
