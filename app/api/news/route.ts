import { NextRequest, NextResponse } from 'next/server';

/* ============================================================================
 * /api/news — live financial headlines from Yahoo Finance's public RSS feeds
 * (no API key required). With ?symbol=TICKER, returns headlines for that
 * ticker; otherwise returns general market headlines (S&P 500 / Dow / Nasdaq).
 * ========================================================================== */

const MARKET_SYMBOLS = '^GSPC,^DJI,^IXIC';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m ? decodeEntities(m[1]) : '';
}

function sourceFromLink(link: string): string {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch { return 'yahoo finance'; }
}

function parseRssItems(xml: string, limit: number) {
  const items: { title: string; link: string; pubDate: string; description: string; source: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) && items.length < limit) {
    const block = m[1];
    const link = tag(block, 'link');
    const title = tag(block, 'title');
    if (!title || !link) continue;
    items.push({ title, link, pubDate: tag(block, 'pubDate'), description: tag(block, 'description'), source: sourceFromLink(link) });
  }
  return items;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const feedSymbols = symbol ? symbol.toUpperCase() : MARKET_SYMBOLS;

  try {
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(feedSymbols)}&region=US&lang=en-US`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
    );
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    const xml = await res.text();
    const items = parseRssItems(xml, 20);
    return NextResponse.json({ items, symbol: symbol ?? null, live: true });
  } catch (error) {
    console.error('News feed fetch failed:', error);
    return NextResponse.json({ items: [], symbol: symbol ?? null, live: false, error: 'News feed temporarily unavailable' });
  }
}
