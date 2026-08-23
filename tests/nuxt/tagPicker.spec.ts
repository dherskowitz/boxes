import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { DOMWrapper } from '@vue/test-utils'
import TagPicker from '~/components/TagPicker.vue'
import type { StorageTag } from '~/types/pocketbase'

const winter: StorageTag = {
  id: 't_winter',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z',
  name: 'winter',
  color: '#2563eb',
  created_by: 'u_dana'
}
const kitchen: StorageTag = {
  id: 't_kitchen',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z',
  name: 'kitchen',
  color: '#16a34a',
  created_by: 'u_dana'
}
const taxRecords: StorageTag = {
  id: 't_tax_records',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z',
  name: 'tax records',
  color: '#ca8a04',
  created_by: 'u_dana'
}
const created: StorageTag = {
  id: 't_sporting',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z',
  name: 'sporting goods',
  color: '',
  created_by: 'u_dana'
}

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

mockNuxtImport('useTags', () => {
  return () => ({ data: ref([winter, kitchen, taxRecords]), isPending: ref(false) })
})

mockNuxtImport('useCreateTag', () => {
  return () => ({ mutateAsync, isPending: ref(false) })
})

// The `search` variant shows a box count beside each option.
mockNuxtImport('useTagUsage', () => {
  return () => ({
    data: ref([
      { id: 't_winter', name: 'winter', color: '#2563eb', box_count: 6, item_count: 2 },
      { id: 't_kitchen', name: 'kitchen', color: '#16a34a', box_count: 1, item_count: 9 }
    ]),
    isPending: ref(false)
  })
})

/**
 * The options render inside the component now rather than in a teleported
 * listbox, so they are reachable through the wrapper. Opening is a focus, not
 * a mount: the list stays hidden until the field is asked for.
 */
async function search(wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) {
  const input = wrapper.find('[data-testid="tag-search"]')
  await input.trigger('focus')
  await input.setValue(text)
}

function optionNamed(wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) {
  const options: DOMWrapper<Element>[] = wrapper.findAll('[role="option"]')
  const option = options.find(el => el.text().includes(text))
  if (!option) throw new Error(`No option containing "${text}" found`)
  return option
}

describe('TagPicker, search variant', () => {
  afterEach(() => {
    mutateAsync.mockClear()
  })

  it('offers the existing tag list for autocomplete', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await search(wrapper, 'win')
    expect(wrapper.find('[data-testid="tag-options"]').text()).toContain('winter')
  })

  it('shows how many boxes already carry each tag', async () => {
    // The point of the count is to make the shared spelling the easy pick
    // rather than inventing a near-duplicate.
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await search(wrapper, 'win')
    expect(optionNamed(wrapper, 'winter').text()).toContain('6 boxes')
  })

  it('says "1 box" rather than "1 boxes"', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await search(wrapper, 'kitchen')
    expect(optionNamed(wrapper, 'kitchen').text()).toContain('1 box')
    expect(optionNamed(wrapper, 'kitchen').text()).not.toContain('1 boxes')
  })

  it('adds a selected tag to the model and renders it as a chip', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await search(wrapper, 'win')
    await optionNamed(wrapper, 'winter').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_winter']])
    await wrapper.setProps({ modelValue: ['t_winter'] })
    expect(wrapper.find('[data-testid="selected-tag-t_winter"]').exists()).toBe(true)
  })

  it('stops offering a tag that is already selected', async () => {
    // Picking it a second time is a no-op, and an option that does nothing is
    // worse than no option. The create row stays: "win" is not "winter", and
    // creating a tag by that name is still a reasonable thing to want.
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: ['t_winter'] } })
    await search(wrapper, 'win')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
  })

  it('removes a tag from the model when its chip is removed', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: ['t_winter'] } })
    await wrapper.find('[data-testid="remove-tag-t_winter"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('offers to create a tag with no existing match, and adds the created tag to the model', async () => {
    mutateAsync.mockResolvedValueOnce(created)
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await search(wrapper, 'Sporting Goods')

    const create = wrapper.find('[data-testid="create-tag"]')
    // Offered in the name it will actually be stored under, not as typed.
    expect(create.text()).toContain('sporting goods')

    await create.trigger('click')
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: 'sporting goods' }))
    await vi.waitFor(() =>
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_sporting']])
    )
  })

  it('matches an existing tag through the whitespace and case it normalises away', async () => {
    // 'Tax   Records' is the same name as the stored 'tax records' as far as
    // `normalizeTagName` is concerned. A raw substring match would find
    // neither a match nor anything to create, leaving a dead end for input the
    // app already treats as a duplicate.
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await search(wrapper, 'Tax   Records')

    expect(wrapper.find('[data-testid="create-tag"]').exists()).toBe(false)
    await optionNamed(wrapper, 'tax records').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_tax_records']])
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})

describe('TagPicker, chips variant', () => {
  afterEach(() => {
    mutateAsync.mockClear()
  })

  it('lays the whole vocabulary out as toggles', async () => {
    const wrapper = await mountSuspended(TagPicker, {
      props: { modelValue: [], variant: 'chips' }
    })
    expect(wrapper.find('[data-testid="tag-option-t_winter"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tag-option-t_kitchen"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tag-option-t_tax_records"]').exists()).toBe(true)
  })

  it('selects a tag on tap', async () => {
    const wrapper = await mountSuspended(TagPicker, {
      props: { modelValue: [], variant: 'chips' }
    })
    await wrapper.find('[data-testid="tag-option-t_kitchen"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_kitchen']])
  })

  it('deselects a tag that is already on, so the same chip is the toggle', async () => {
    const wrapper = await mountSuspended(TagPicker, {
      props: { modelValue: ['t_kitchen'], variant: 'chips' }
    })
    await wrapper.find('[data-testid="selected-tag-t_kitchen"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('marks a selected chip pressed, so it is not colour alone that says so', async () => {
    const wrapper = await mountSuspended(TagPicker, {
      props: { modelValue: ['t_kitchen'], variant: 'chips' }
    })
    expect(wrapper.find('[data-testid="selected-tag-t_kitchen"]').attributes('aria-pressed'))
      .toBe('true')
    expect(wrapper.find('[data-testid="tag-option-t_winter"]').attributes('aria-pressed'))
      .toBe('false')
  })
})
