import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, DataTable, DropdownMenu, Modal, StatusBadge, Tabs, type Column } from '.';

describe('Button', () => {
  it('is disabled and busy while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});

describe('StatusBadge', () => {
  it('renders the status label', () => {
    render(<StatusBadge status="NeedsManualReview" />);
    expect(screen.getByText('Needs Manual Review')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    return (
      <Modal open onClose={onClose} title="Confirm">
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
  }

  it('is a labelled dialog, closes on Escape, and traps focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Last' })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden">x</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DropdownMenu', () => {
  it('opens, selects an item and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={(p) => <button {...p}>Menu</button>}
        items={[{ label: 'Do it', onSelect }]}
      />,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('switches panels and supports arrow keys', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [v, setV] = useState('a');
      return (
        <Tabs
          value={v}
          onChange={setV}
          items={[
            { id: 'a', label: 'A', content: 'panel a' },
            { id: 'b', label: 'B', content: 'panel b' },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel a');
    screen.getByRole('tab', { name: 'A' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel b');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('DataTable', () => {
  interface Row { id: string; name: string; n: number }
  const rows: Row[] = [
    { id: '1', name: 'Bravo', n: 2 },
    { id: '2', name: 'Alpha', n: 3 },
    { id: '3', name: 'Charlie', n: 1 },
  ];
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Name', cell: (r) => r.name, sortValue: (r) => r.name },
    { key: 'n', header: 'Count', cell: (r) => r.n, sortValue: (r) => r.n },
  ];
  const names = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent?.replace(/\d+$/, ''));

  it('sorts ascending then descending', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('paginates', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={2} />);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="Nothing" />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
  });
});
