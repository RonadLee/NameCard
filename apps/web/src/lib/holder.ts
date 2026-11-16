export const holderPageSize = 59;

export type HolderState = {
  scope: "mine" | "company";
  group: string;
  sort: string;
  q: string;
  page: number;
};

export function readHolder(search: { get(name: string): string | null }): HolderState {
  const sort = search.get("sort");
  return {
    scope: search.get("scope") === "company" ? "company" : "mine",
    group: search.get("group") ?? "",
    sort: sort === "name" || sort === "company" ? sort : "created",
    q: search.get("q") ?? "",
    page: Math.max(1, Number(search.get("page")) || 1),
  };
}

export function holderHref(state: HolderState, id?: string) {
  const params = new URLSearchParams();
  if (state.scope === "company") params.set("scope", "company");
  if (state.group) params.set("group", state.group);
  if (state.sort !== "created") params.set("sort", state.sort);
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  const path = id ? `/cardholder/${id}` : "/cardholder";
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
