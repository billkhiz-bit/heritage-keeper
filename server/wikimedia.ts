// Wikimedia Commons photo search — server-side

const IRRELEVANT_PATTERNS =
  /\b(flag|coat of arms|logo|icon|seal|emblem|map|diagram|chart|graph|stamp|medal|badge|banner|svg|insignia|heraldry)\b/i;

export interface WikiPhoto {
  url: string;
  title: string;
  description: string;
}

export async function searchPhotos(
  query: string,
  count = 3
): Promise<WikiPhoto[]> {
  try {
    const searchQuery = encodeURIComponent(`${query} filetype:bitmap`);
    const limit = count * 3;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${searchQuery}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=600&format=json&origin=*`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    return (Object.values(pages) as any[])
      .map((page) => {
        const info = page.imageinfo?.[0];
        if (!info?.thumburl) return null;

        const mime = info.mime || '';
        if (!mime.startsWith('image/jpeg') && !mime.startsWith('image/png'))
          return null;
        if (info.width < 200 || info.height < 150) return null;

        const title = page.title || '';
        if (IRRELEVANT_PATTERNS.test(title)) return null;

        const meta = info.extmetadata || {};
        const cleanTitle = (
          meta.ObjectName?.value ||
          title.replace('File:', '')
        ).replace(/<[^>]*>/g, '');

        if (IRRELEVANT_PATTERNS.test(cleanTitle)) return null;

        return {
          url: info.thumburl,
          title: cleanTitle.slice(0, 100),
          description: (meta.ImageDescription?.value || '')
            .replace(/<[^>]*>/g, '')
            .slice(0, 150),
        };
      })
      .filter(Boolean)
      .slice(0, count) as WikiPhoto[];
  } catch (err) {
    console.warn('Wikimedia fetch failed:', err);
    return [];
  }
}

export async function searchMultipleQueries(
  queries: string[],
  perQuery = 3
): Promise<WikiPhoto[]> {
  const results = await Promise.all(
    queries.map((q) => searchPhotos(q, perQuery))
  );
  const all = results.flat();
  // Deduplicate by URL
  const seen = new Set<string>();
  return all.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
}
