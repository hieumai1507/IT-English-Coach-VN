"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  id?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  onCreateOption?: (value: string) => void;
};

export const SearchableSelect = React.forwardRef<HTMLButtonElement, SearchableSelectProps>(
  (
    {
      id,
      options,
      value,
      onValueChange,
      onCreateOption,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");

    const selectedOption = React.useMemo(
      () => options.find((opt) => opt.value === value),
      [options, value],
    );

    const filteredOptions = React.useMemo(() => {
      if (!searchValue.trim()) return options;
      const q = searchValue.toLowerCase();
      return options.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, searchValue]);

    const showCreateOption =
      !!onCreateOption &&
      !!searchValue.trim() &&
      !options.some((opt) => opt.label.toLowerCase() === searchValue.trim().toLowerCase());

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between")}
          >
            <span className="truncate text-left">
              {selectedOption?.label ?? <span className="text-muted-foreground">Select an option</span>}
            </span>
            <div className="ml-2 flex items-center gap-1">
              {selectedOption && (
                <X
                  className="h-4 w-4 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onValueChange?.("");
                  }}
                />
              )}
              <ChevronDown className="h-4 w-4 opacity-60" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {filteredOptions.length === 0 && !showCreateOption ? (
                <CommandEmpty>No options found</CommandEmpty>
              ) : (
                <CommandGroup>
                  {showCreateOption && (
                    <CommandItem
                      onSelect={() => {
                        const created = searchValue.trim();
                        if (!created) return;
                        onCreateOption?.(created);
                        setOpen(false);
                        setSearchValue("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Create "{searchValue.trim()}"
                    </CommandItem>
                  )}
                  {filteredOptions.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onValueChange?.(opt.value);
                        setOpen(false);
                        setSearchValue("");
                      }}
                    >
                      <span className="flex-1">{opt.label}</span>
                      <Check className={cn("h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

SearchableSelect.displayName = "SearchableSelect";
