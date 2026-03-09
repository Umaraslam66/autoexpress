import { chromium, type BrowserContext, type Page } from 'playwright';

let browserPromise: ReturnType<typeof chromium.launch> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
    });
  }

  return browserPromise;
}

async function resetBrowser() {
  if (!browserPromise) {
    return;
  }

  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // Ignore close errors during forced reset.
  } finally {
    browserPromise = null;
  }
}

function isTransientNavigationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('ERR_NETWORK_CHANGED') ||
    error.message.includes('ERR_INTERNET_DISCONNECTED') ||
    error.message.includes('ERR_NETWORK_IO_SUSPENDED') ||
    error.message.includes('ERR_CONNECTION_RESET') ||
    error.message.includes('ERR_CONNECTION_CLOSED') ||
    error.message.includes('ERR_CONNECTION_ABORTED') ||
    error.message.includes('Target page, context or browser has been closed')
  );
}

export async function withBrowserContext<T>(run: (context: BrowserContext, page: Page) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const browser = await getBrowser();
    const context = await browser.newContext({
      locale: 'en-IE',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 1200 },
    });
    const page = await context.newPage();

    try {
      return await run(context, page);
    } catch (error) {
      lastError = error;
      if (attempt === 2 || !isTransientNavigationError(error)) {
        throw error;
      }

      console.warn(`Browser context failed with a transient error. Resetting browser and retrying (attempt ${attempt + 1}/2).`);
      await resetBrowser();
      await page.waitForTimeout(1000).catch(() => undefined);
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  throw lastError;
}

export async function dismissConsent(page: Page): Promise<void> {
  await page.getByRole('button', { name: /accept/i }).click({ timeout: 3000 }).catch(() => undefined);
}

export async function gotoWithRetry(
  page: Page,
  url: string,
  options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'; timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? 60000;
  const waitUntil = options.waitUntil ?? 'domcontentloaded';
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3 || !isTransientNavigationError(error)) {
        throw error;
      }

      console.warn(`Navigation to ${url} failed with a transient network error. Retrying (${attempt + 1}/3).`);
      await page.waitForTimeout(1500 * attempt);
    }
  }

  throw lastError;
}
