import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import ar from "@/i18n/ar";
import en from "@/i18n/en";
import ur from "@/i18n/ur";
export interface TicketCatalogCandidate {
  id: number; name: string; nameEn?: string; unit: string; code: string;
  availableQuantity?: number; usedByTeam?: boolean;
}
/** PMV2's inline material combobox, with ticket catalog candidates and callbacks. */
export function TicketMaterialCatalogPicker({ items, selected, search, onSearch, onSelect, blockedIds, loading, disabled, language }: {
  items: TicketCatalogCandidate[]; selected: TicketCatalogCandidate | null; search: string;
  onSearch: (value: string) => void; onSelect: (item: TicketCatalogCandidate) => void;
  blockedIds: number[]; loading: boolean; disabled: boolean; language: string;
}) {
  const [open, setOpen] = useState(false);
  const t = (language === "ar" ? ar : language === "ur" ? ur : en).workflow.pmv2;
  const name = (item: TicketCatalogCandidate) => language === "en" ? item.nameEn || item.name : item.name;
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (!value) onSearch(""); }}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="h-auto min-h-10 w-full justify-between gap-2 px-3 py-2 text-start font-normal"><span className="min-w-0 flex-1">{selected ? <span className="flex min-w-0 flex-col items-start gap-0.5"><span className="w-full truncate font-medium">{name(selected)}{selected.code ? ` — ${selected.code}` : ""}</span><span className="text-[11px] text-muted-foreground">{t.teamAvailable.replace("{qty}", String(selected.availableQuantity ?? 0)).replace("{unit}", selected.unit)}</span></span> : <span className="text-muted-foreground">{t.searchChooseMaterial}</span>}</span><ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" dir={language === "en" ? "ltr" : "rtl"}>
      <Command shouldFilter={false}><CommandInput value={search} onValueChange={onSearch} placeholder={t.searchMaterialCode} />
        <CommandList>{loading && <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.searchingCatalog}</div>}
          {!loading && !items.length && <CommandEmpty>{t.noMatchingMaterial}</CommandEmpty>}
          <CommandGroup heading={search.trim() ? t.searchAllCatalogResults : t.smartSuggestions}>{items.map(item => {
            const blocked = blockedIds.includes(item.id);
            const smartLabel = (item.availableQuantity ?? 0) > 0 ? t.availableTeamStore : item.usedByTeam ? t.usedByTeam : null;
            return <CommandItem key={item.id} value={`${item.name} ${item.nameEn ?? ""} ${item.code}`} disabled={blocked || disabled} onSelect={() => { if (blocked || disabled) return; onSelect(item); onSearch(""); setOpen(false); }} className="items-start py-2"><Check className={`mt-0.5 h-4 w-4 ${selected?.id === item.id ? "opacity-100" : "opacity-0"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="font-medium leading-5">{name(item)}</span>{smartLabel && <Badge variant={(item.availableQuantity ?? 0) > 0 ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">{smartLabel}</Badge>}</div><div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground"><span>{t.codeLabel}: {item.code}</span><span>{t.balanceValue.replace("{qty}", String(item.availableQuantity ?? 0)).replace("{unit}", item.unit)}</span>{blocked && <span className="font-medium text-amber-700">{t.alreadyRequested}</span>}</div></div></CommandItem>;
          })}</CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
