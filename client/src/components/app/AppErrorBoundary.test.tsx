/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom() {
  throw new Error('kaboom');
}

describe('AppErrorBoundary', () => {
  it('renders fallback UI when child throws', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('We hit a page error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  });
});
