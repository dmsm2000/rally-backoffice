import { Component, OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api';
import { POST_KINDS, POST_TYPES, TONE_CLASSES, appUrl, formatDateTime, memberNumber, options, playerName, timeAgo } from '../../core/format';
import { PostRow } from '../../core/models';
import { ModerationStore } from '../../core/moderation-store';
import { ConfirmService } from '../../ui/confirm.service';
import { Dialog } from '../../ui/dialog';
import { Icon } from '../../ui/icon';
import { Pager, SearchBox } from '../../ui/list-controls';
import { PageHeader } from '../../ui/page-header';
import { EmptyState, ErrorState, SkeletonCards } from '../../ui/state-panels';
import { BTN_DANGER, BTN_GHOST, BTN_LINK, BTN_PRIMARY, CARD, CHIP, CHIP_ACTIVE, CHIP_IDLE, INPUT, LABEL, PILL } from '../../ui/styles';
import { ToastService } from '../../ui/toast.service';

type Filter = 'all' | 'authored' | 'announcement' | 'reported';
const LIMIT = 30;
const TEXT_MAX = 280;

const FILTERS: { key: Filter; param: string | null; label: string }[] = [
  { key: 'all', param: null, label: 'Todas' },
  { key: 'authored', param: 'players', label: 'De jogadores' },
  { key: 'announcement', param: 'announcements', label: 'Anúncios automáticos' },
  { key: 'reported', param: 'reported', label: 'Com denúncias abertas' }
];

interface Composer {
  mode: 'create' | 'edit';
  post: PostRow | null;
  text: string;
  type: string;
  file: File | null;
  preview: string | null;
}

@Component({
  selector: 'bo-posts-page',
  imports: [RouterLink, Icon, Dialog, PageHeader, SearchBox, Pager, EmptyState, ErrorState, SkeletonCards],
  templateUrl: './posts.page.html'
})
export class PostsPage implements OnDestroy {
  private readonly api = inject(AdminApi);
  private readonly store = inject(ModerationStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly filterParam = input<string>(undefined, { alias: 'filter' });
  readonly authorParam = input<string>(undefined, { alias: 'author' });

  protected readonly filters = FILTERS;
  protected readonly filter = computed<Filter>(() => FILTERS.find(f => f.param === this.filterParam())?.key ?? 'all');
  protected readonly search = signal('');
  protected readonly offset = signal(0);
  protected readonly rows = signal<PostRow[] | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly composer = signal<Composer | null>(null);

  /** The author the list is narrowed to, named from the first row once it loads. */
  protected readonly authorName = computed(() => {
    const author = this.authorParam();
    return author ? (this.rows()?.find(row => row.author_id === author)?.author_name ?? 'um jogador') : null;
  });

  protected readonly limit = LIMIT;
  protected readonly textMax = TEXT_MAX;
  protected readonly kinds = POST_KINDS;
  protected readonly types = POST_TYPES;
  protected readonly typeOptions = options(POST_TYPES);
  protected readonly tones = TONE_CLASSES;
  protected readonly ago = timeAgo;
  protected readonly dateTime = formatDateTime;
  protected readonly member = memberNumber;
  protected readonly name = playerName;
  protected readonly styles = {
    card: CARD,
    pill: PILL,
    ghost: BTN_GHOST,
    primary: BTN_PRIMARY,
    danger: BTN_DANGER,
    link: BTN_LINK,
    input: INPUT,
    label: LABEL,
    chip: CHIP,
    chipActive: CHIP_ACTIVE,
    chipIdle: CHIP_IDLE
  };

  private requestId = 0;

  constructor() {
    effect(() => {
      const request = { search: this.search(), filter: this.filter(), author: this.authorParam() ?? null, offset: this.offset() };
      untracked(() => void this.load(request));
    });
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  protected setFilter(param: string | null): void {
    this.offset.set(0);
    void this.router.navigate([], { queryParams: { filter: param }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected clearAuthor(): void {
    this.offset.set(0);
    void this.router.navigate([], { queryParams: { author: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected setSearch(value: string): void {
    this.offset.set(0);
    this.search.set(value);
  }

  protected postUrl(id: string): string {
    return appUrl(`/posts/${id}`);
  }

  protected async reload(): Promise<void> {
    await this.load({ search: this.search(), filter: this.filter(), author: this.authorParam() ?? null, offset: this.offset() });
  }

  protected openCreate(): void {
    this.composer.set({ mode: 'create', post: null, text: '', type: '', file: null, preview: null });
  }

  protected openEdit(post: PostRow): void {
    this.composer.set({ mode: 'edit', post, text: post.post_text, type: post.post_type ?? '', file: null, preview: null });
  }

  protected closeComposer(): void {
    this.revokePreview();
    this.composer.set(null);
  }

  protected patchComposer(change: Partial<Composer>): void {
    this.composer.update(composer => (composer ? { ...composer, ...change } : composer));
  }

  protected pickFile(field: HTMLInputElement): void {
    const file = field.files?.[0] ?? null;
    field.value = '';
    if (file && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      this.toast.error(new Error('Escolhe uma imagem ou um vídeo.'));
      return;
    }
    this.revokePreview();
    this.patchComposer({ file, preview: file ? URL.createObjectURL(file) : null });
  }

  protected removeFile(): void {
    this.revokePreview();
    this.patchComposer({ file: null, preview: null });
  }

  protected canSubmit(composer: Composer): boolean {
    const text = composer.text.trim();
    if (text.length > TEXT_MAX) {
      return false;
    }
    if (composer.mode === 'create') {
      return !!text || !!composer.file;
    }
    return !!text || !!composer.post?.media_url || composer.post?.kind !== 'authored';
  }

  protected async submitComposer(): Promise<void> {
    const composer = this.composer();
    if (!composer || !this.canSubmit(composer) || this.busy()) {
      return;
    }
    this.busy.set('composer');
    try {
      if (composer.mode === 'create') {
        await this.api.createPost(composer.text.trim(), composer.type || null, composer.file);
        this.toast.ok('Publicado em teu nome.');
        void this.store.refresh();
        this.offset.set(0);
      } else if (composer.post) {
        await this.api.updatePost(composer.post.id, composer.text.trim(), composer.type || null);
        this.toast.ok('Publicação guardada.');
      }
      this.closeComposer();
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(post: PostRow): Promise<void> {
    const details = [
      post.media_url ? (post.media_type === 'video' ? 'O vídeo é removido do Storage.' : 'A foto é removida do Storage.') : null,
      `${post.likes} ${post.likes === 1 ? 'gosto' : 'gostos'} e as denúncias desta publicação.`,
      post.kind !== 'authored' ? 'É um anúncio automático: o que anuncia continua a existir.' : null,
      'O autor não é avisado.'
    ].filter((detail): detail is string => !!detail);
    const confirmed = await this.confirm.ask({
      title: 'Apagar esta publicação?',
      message: `De ${playerName(post.author_name)}. Não dá para desfazer.`,
      details,
      confirmLabel: 'Apagar publicação',
      tone: 'danger'
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(post.id);
    try {
      const outcome = await this.api.deletePost(post.id);
      this.toast.ok('Publicação apagada.');
      if (outcome.filesLeft) {
        this.toast.warn('O ficheiro ficou no Storage.');
      }
      void this.store.refresh();
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(request: { search: string; filter: Filter; author: string | null; offset: number }): Promise<void> {
    const id = ++this.requestId;
    this.rows.set(null);
    this.error.set(null);
    try {
      const result = await this.api.posts(
        {
          search: request.search,
          kind: request.filter === 'authored' || request.filter === 'announcement' ? request.filter : 'all',
          author: request.author,
          reported: request.filter === 'reported'
        },
        LIMIT,
        request.offset
      );
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

  private revokePreview(): void {
    const preview = this.composer()?.preview;
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  }
}
