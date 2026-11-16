import type { Contact } from "./types";

export type HolderPage = { items: Contact[]; total: number; page: number; pageSize: number };

export type HolderInfinite = { pages: HolderPage[]; pageParams: unknown[] };

export function editMobileContacts(current: HolderInfinite | undefined, id: string, map: (contact: Contact) => Contact | null) {
  if (!current) return current;
  return {
    ...current,
    pages: current.pages.map((page) => {
      let removed = 0;
      const items = page.items.flatMap((item) => {
        if (item.id !== id) return [item];
        const next = map(item);
        if (!next) {
          removed += 1;
          return [];
        }
        return [next];
      });
      return { ...page, items, total: Math.max(0, page.total - removed) };
    }),
  };
}
