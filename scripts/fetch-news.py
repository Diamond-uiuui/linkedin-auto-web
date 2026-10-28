"""Fetch public RSS headlines. No API credentials or full article content."""
import json
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

FEED = 'https://rss.app/feeds/_BZbsZyrcRhT3rIyx.xml'

def main():
    target = Path(sys.argv[1] if len(sys.argv) > 1 else 'web/news.json')
    with urlopen(Request(FEED, headers={'User-Agent': 'LuxuryWorkshop/1.0'}), timeout=30) as response:
        content = response.read(3_000_001)
    if len(content) > 3_000_000:
        raise ValueError('RSS exceeds size limit')
    root = ET.fromstring(content)
    items, seen = [], set()
    for entry in root.findall('.//item'):
        title = (entry.findtext('title') or '').strip()
        link = (entry.findtext('link') or '').strip()
        parsed = urlparse(link)
        if not title or parsed.scheme not in ('http', 'https') or parsed.username or link in seen:
            continue
        seen.add(link)
        rawdate = entry.findtext('pubDate') or ''
        try:
            date = parsedate_to_datetime(rawdate).isoformat()
        except (TypeError, ValueError):
            date = ''
        items.append({'title': title[:350], 'url': link, 'date': date, 'source': parsed.hostname})
    if not items:
        raise ValueError('RSS returned no items; preserving previous snapshot')
    items.sort(key=lambda item: item['date'], reverse=True)
    data = {'updatedAt': datetime.now(timezone.utc).isoformat(), 'feedUrl': FEED, 'items': items[:80]}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Saved {len(data["items"])} public headlines')

if __name__ == '__main__':
    main()
