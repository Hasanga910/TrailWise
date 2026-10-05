import { describe, expect, it, vi } from 'vitest';

const { error, success } = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error, success, info: vi.fn(), warning: vi.fn(), promise: vi.fn() } }));

import { notify } from './notify';

describe('notify', () => {
  it('keeps error toasts until dismissed', () => {
    notify.error('Failed', 'detail');
    expect(error).toHaveBeenCalledWith('Failed', { description: 'detail', duration: Infinity });
  });

  it('uses the default duration for success toasts', () => {
    notify.success('Saved');
    expect(success).toHaveBeenCalledWith('Saved', { description: undefined });
  });
});
