import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { LinkApiService, ShortLink } from './link-api.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  readonly links = signal<ShortLink[]>([]);
  readonly urlInput = signal('');
  readonly newLink = signal<ShortLink | null>(null);
  readonly errorMessage = signal('');
  readonly listError = signal('');
  readonly isSubmitting = signal(false);
  readonly isLoading = signal(false);
  readonly copied = signal(false);

  constructor(private readonly linkApi: LinkApiService) {}

  ngOnInit(): void {
    this.refreshLinks();
  }

  refreshLinks(): void {
    this.isLoading.set(true);
    this.listError.set('');

    this.linkApi.getLinks().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (links) => this.links.set(links),
      error: (error: unknown) => this.listError.set(this.describeError(error)),
    });
  }

  shorten(): void {
    const rawUrl = this.urlInput().trim();
    let url: URL;

    try {
      url = new URL(rawUrl);
    } catch {
      this.errorMessage.set('Enter a valid http:// or https:// URL.');
      this.newLink.set(null);
      return;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      this.errorMessage.set('Enter a valid http:// or https:// URL.');
      this.newLink.set(null);
      return;
    }

    this.errorMessage.set('');
    this.newLink.set(null);
    this.copied.set(false);
    this.isSubmitting.set(true);

    this.linkApi.createLink(url.href).pipe(
      finalize(() => this.isSubmitting.set(false))
    ).subscribe({
      next: (link) => {
        this.newLink.set(link);
        this.links.update((links) => [link, ...links.filter((item) => item.code !== link.code)]);
        this.urlInput.set('');
      },
      error: (error: unknown) => this.errorMessage.set(this.describeError(error)),
    });
  }

  async copyShortUrl(shortUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shortUrl);
      this.copied.set(true);
    } catch {
      this.errorMessage.set('Copying is unavailable here. Select and copy the link instead.');
    }
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Something went wrong. Please try again.';
    if (error.status === 0) return 'Cannot reach the Snip API at http://localhost:3000.';

    const payload = error.error as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
    return `The request failed (${error.status}). Please try again.`;
  }
}
