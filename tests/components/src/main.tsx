'use client'
import { createRoot } from 'react-dom/client'
import { readComponentOptions } from './contract'
import { Harness } from './harness'
import './harness.css'

function failureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : 'Unknown component harness error'
}

function renderFailure(root: HTMLElement, error: unknown): void {
  const message = failureMessage(error)
  document.documentElement.dataset.componentHarness = 'error'
  const alert = document.createElement('div')
  alert.dataset.componentHarnessError = ''
  alert.setAttribute('role', 'alert')
  alert.textContent = message
  root.replaceChildren(alert)
}

const root = document.getElementById('component-harness-root')
if (root === null) {
  throw new Error('Component harness root is missing')
}
try {
  const options = readComponentOptions(new URLSearchParams(window.location.search))
  createRoot(root).render(<Harness options={options} />)
}
catch (error) {
  renderFailure(root, error)
}
