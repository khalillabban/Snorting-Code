import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />)
    const heading = screen.getByText(/Snorting Code/i)
    expect(heading).toBeInTheDocument()
  })

  it('renders the project description', () => {
    render(<App />)
    const description = screen.getByText(/React \+ TypeScript \+ Tailwind CSS/i)
    expect(description).toBeInTheDocument()
  })
})
