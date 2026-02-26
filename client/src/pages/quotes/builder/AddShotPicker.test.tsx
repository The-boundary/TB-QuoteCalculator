/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddShotPicker } from './AddShotPicker';

describe('AddShotPicker numeric coercion', () => {
  it('coerces string hours to number when calling onAdd', () => {
    const onAdd = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <AddShotPicker
        rateCardItems={[
          { shot_type: 'Material Board', category: 'material', hours: '16' as any, sort_order: 0 },
        ]}
        existingShotTypes={[]}
        onAdd={onAdd}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByText('Material Board'));
    expect(onAdd).toHaveBeenCalledWith('Material Board', 16);
    expect(typeof onAdd.mock.calls[0][1]).toBe('number');
  });
});
