import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Workbench Dashboard/i)).toBeDefined();
  });

  it('renders default route with homepage', () => {
    render(<App />);
    expect(screen.getByText(/AI Dev OS/i)).toBeDefined();
    expect(screen.getByText(/View Runs/i)).toBeDefined();
    expect(screen.getByText(/View Plans/i)).toBeDefined();
  });
});
