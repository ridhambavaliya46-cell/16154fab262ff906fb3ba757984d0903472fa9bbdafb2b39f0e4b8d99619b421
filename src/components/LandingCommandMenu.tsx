import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, FileSearch, Search } from 'lucide-react';
import { useLenisScroll } from '../context/LenisContext.js';

type Command = {
  label: string;
  detail: string;
  target?: string;
  action?: 'scan';
};

const commands: Command[] = [
  { label: 'Overview', detail: 'Back to the first section', target: '#hero' },
  { label: 'How it works', detail: 'See the three-step process', target: '#how-it-works' },
  { label: 'Features', detail: 'Explore the workspace tools', target: '#capabilities' },
  { label: 'Word export', detail: 'Preview the single-column document', target: '#export-preview' },
  { label: 'What you get', detail: 'Review score, gaps, and guidance', target: '#proof' },
  { label: 'Pricing', detail: 'Compare Free and Pro', target: '#pricing' },
  { label: 'Frequently asked questions', detail: 'Find an answer', target: '#faq' },
  { label: 'Analyze a resume', detail: 'Open the resume analysis flow', action: 'scan' },
];

export const LandingCommandMenu: React.FC<{ onScanClick: () => void }> = ({ onScanClick }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { scrollTo } = useLenisScroll();

  useEffect(() => {
    const open = () => setIsOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('resumesetu:open-command', open);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resumesetu:open-command', open);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => searchRef.current?.focus());
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.detail}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const runCommand = (command: Command) => {
    setIsOpen(false);
    setQuery('');
    if (command.action === 'scan') {
      onScanClick();
      return;
    }
    if (command.target) scrollTo(command.target, { offset: -88, duration: 0.9 });
  };

  const browseCommands = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = currentIndex < 0
      ? (direction === 1 ? 0 : items.length - 1)
      : (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  };

  return (
    <dialog
      ref={dialogRef}
      className="command-palette"
      aria-labelledby="landing-command-title"
      onKeyDown={browseCommands}
      onClose={() => {
        setIsOpen(false);
        setQuery('');
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="command-palette__panel">
        <h2 id="landing-command-title" className="sr-only">Quick navigation</h2>
        <div className="command-palette__search">
          <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
          <label className="sr-only" htmlFor="landing-command-search">Search sections and actions</label>
          <input
            ref={searchRef}
            id="landing-command-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections and actions…"
            autoComplete="off"
          />
          <kbd>ESC</kbd>
        </div>

        <div ref={listRef} className="command-palette__list" role="group" aria-label="Quick navigation">
          {filteredCommands.map((command) => (
            <button
              key={command.label}
              type="button"
              className="command-palette__item"
              onClick={() => runCommand(command)}
            >
              <span className="command-palette__icon">
                {command.action === 'scan' ? <FileSearch className="h-4 w-4" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold">{command.label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--landing-muted)]">{command.detail}</span>
              </span>
              <span className="text-xs text-[var(--landing-muted)]">↵</span>
            </button>
          ))}
          {filteredCommands.length === 0 && (
            <p className="command-palette__empty">No matching sections or actions.</p>
          )}
        </div>

        <div className="command-palette__footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to browse</span>
          <span><kbd>ENTER</kbd> to open</span>
        </div>
      </div>
    </dialog>
  );
};
