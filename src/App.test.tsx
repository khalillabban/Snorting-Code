import { render, screen } from '@testing-library/react-native';
import App from './App';

describe('App', () => {
  it('renders correctly', () => {
    render(<App />);
    expect(screen.getByText('Snorting Code')).toBeTruthy();
  });

  it('displays the subtitle', () => {
    render(<App />);
    expect(screen.getByText(/React Native \+ Expo/)).toBeTruthy();
  });

  it('displays project features', () => {
    render(<App />);
    expect(screen.getByText(/Project Setup Complete/)).toBeTruthy();
    expect(screen.getByText(/React Native with Expo/)).toBeTruthy();
  });
});
