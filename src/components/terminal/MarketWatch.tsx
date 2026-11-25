"use client";

import { useMemo } from "react";
import { Search, Star, Wifi, WifiOff } from "lucide-react";
import { useTerminalStore } from "@/lib/store/terminal";
import { Badge, Panel, Segmented } from "@/components/ui/Primitives";
import { formatNumber } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "favourite", label: "★" },
  { value: "synthetic_index", label: "Synth" },
  { value: "forex", label: "Forex" },
  { value: "commodities", label: "Comdty" },
];

export function MarketWatch() {
  const symbols = useTerminalStore((state) => state.symbols);
  const selected = useTerminalStore((state) => state.symbol);
  const favourites = useTerminalStore((state) => state.favourites);
  const filter = useTerminalStore((state) => state.marketFilter);
  const search = useTerminalStore((state) => state.search);
  const selectSymbol = useTerminalStore((state) => state.selectSymbol);
  const toggleFavourite = useTerminalStore((state) => state.toggleFavourite);
  const setFilter = useTerminalStore((state) => state.setMarketFilter);
  const setSearch = useTerminalStore((state) => state.setSearch);
  const lastTick = useTerminalStore((state) => state.ticks[state.ticks.length - 1]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return symbols
      .filter((symbol) => (filter === "all" ? true : filter === "favourite" ? favourites.includes(symbol.symbol) : symbol.market === filter))
      .filter((symbol) => (query ? symbol.displayName.toLowerCase().includes(query) || symbol.symbol.toLowerCase().includes(query) : true))
      .filter((symbol) => symbol.open || symbol.symbol === selected)
      .slice(0, 120);
  }, [symbols, filter, favourites, search, selected]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const symbol of filtered) {
      const key = symbol.marketDisplay;
      map.set(key, [...(map.get(key) ?? []), symbol]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <Panel
      title="Market watch"
      subtitle={`${symbols.length} instruments · live catalogue`}
      icon={<Search size={13} />}
      actions={<Badge tone="neutral">{filtered.length}</Badge>}
      bodyClassName="flex min-h-0 flex-1 flex-col gap-2 p-2"
    >
      <div className="relative">
        <Search size={12} className="pointer-events-none absolute left-2 top-2.5 text-ink-faint" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search symbols…"
          aria-label="Search symbols"
          className="h-8 w-full rounded-lg border border-hairline bg-obsidian/70 pl-7 pr-2 text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-cyan/60"
        />
      </div>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} size="sm" className="w-full overflow-x-auto" />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-0.5">
        {grouped.map(([market, rows]) => (
          <div key={market}>
            <p className="sticky top-0 z-10 bg-panel/95 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint backdrop-blur">
              {market}
            </p>
            <ul className="space-y-0.5">
              {rows.map((symbol) => {
                const isSelected = symbol.symbol === selected;
                const isFavourite = favourites.includes(symbol.symbol);
                const price = isSelected && lastTick ? lastTick.quote : symbol.basePrice;
                return (
                  <li key={symbol.symbol}>
                    <div
                      className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors ${
                        isSelected ? "bg-emerald/10 ring-1 ring-emerald/30" : "hover:bg-panel-2"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={`${isFavourite ? "Remove" : "Add"} ${symbol.displayName} ${isFavourite ? "from" : "to"} favourites`}
                        onClick={() => toggleFavourite(symbol.symbol)}
                        className={`shrink-0 p-0.5 ${isFavourite ? "text-amber" : "text-ink-faint hover:text-amber"}`}
                      >
                        <Star size={11} fill={isFavourite ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => selectSymbol(symbol.symbol)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                        aria-current={isSelected ? "true" : undefined}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-medium text-ink">{symbol.displayName}</span>
                          <span className="block truncate text-[9px] text-ink-faint">{symbol.symbol} · {symbol.submarket}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="num block text-[11px] font-semibold text-ink">
                            {price ? formatNumber(price, symbol.decimals) : "—"}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[9px] ${symbol.open ? "text-emerald" : "text-ink-faint"}`}>
                            {symbol.open ? <Wifi size={8} /> : <WifiOff size={8} />}
                            {symbol.open ? "open" : "closed"}
                          </span>
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline p-3 text-center text-[10px] text-ink-faint">
            No instruments match this filter.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

export default MarketWatch;
