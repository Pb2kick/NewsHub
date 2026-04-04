import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login page heading', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /sign in to newshub/i });
  expect(heading).toBeInTheDocument();
});
