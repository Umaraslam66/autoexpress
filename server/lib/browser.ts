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

export async function withBrowserContext<T>(run: (context: BrowserContext, page: Page) => Promise<T>): Promise<T> {
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
  } finally {
    await context.close();
  }
}

export async function dismissConsent(page: Page): Promise<void> {
  await page.getByRole('button', { name: /accept/i }).click({ timeout: 3000 }).catch(() => undefined);
}

