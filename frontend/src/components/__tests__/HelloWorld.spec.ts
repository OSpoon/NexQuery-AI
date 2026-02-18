import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

// Create a simple component for testing
const HelloWorld = {
  template: '<div>Hello Vitest</div>',
}

describe('helloWorld', () => {
  it('renders correctly', () => {
    const wrapper = mount(HelloWorld)
    expect(wrapper.text()).toContain('Hello Vitest')
  })
})
