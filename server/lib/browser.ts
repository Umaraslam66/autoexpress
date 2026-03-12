import { chromium, type BrowserContext, type Page } from 'playwright';

let browserPromise: ReturnType<typeof chromium.launch> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
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
      extraHTTPHeaders: {
        'Accept-Language': 'en-IE,en-GB;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
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
  // Try multiple common consent button patterns used by Irish car sites
  const patterns = [
    page.getByRole('button', { name: /accept all/i }),
    page.getByRole('button', { name: /accept cookies/i }),
    page.getByRole('button', { name: /accept/i }),
    page.getByRole('button', { name: /agree/i }),
    page.getByRole('button', { name: /allow all/i }),
    page.getByRole('button', { name: /i agree/i }),
    page.locator('[id*="accept"]').first(),
    page.locator('[class*="accept"]').first(),
    page.locator('button[data-cookiebanner="accept_button"]').first(),
  ];

  for (const locator of patterns) {
    try {
      await locator.click({ timeout: 2000 });
      await page.waitForTimeout(800);
      return;
    } catch {
      // Try next pattern
    }
  }
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
