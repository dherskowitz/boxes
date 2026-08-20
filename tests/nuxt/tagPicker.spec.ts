import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
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

// Nuxt UI's InputMenu teleports its dropdown to <body> by default, so its
// options live outside the mounted wrapper's own DOM subtree — query the
// live document directly to find and click one.
async function clickOption(text: string) {
  const option = [...document.querySelectorAll('[role="option"]')]
    .find(el => el.textContent?.includes(text))
  if (!option) throw new Error(`No option containing "${text}" found`)
  option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await nextTick()
}

describe('TagPicker', () => {
  // Nuxt UI's dropdown teleports into <body> and is never unmounted between
  // tests (mountSuspended's wrapper is never attached to the document), so a
  // prior test's options would otherwise linger and pollute the next query.
  afterEach(() => {
    document.body.innerHTML = ''
    mutateAsync.mockClear()
  })

  it('offers the existing tag list for autocomplete', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await wrapper.find('input').setValue('win')
    expect(document.body.textContent).toContain('winter')
  })

  it('adds a selected tag to the model and renders it as a chip', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await wrapper.find('input').setValue('win')
    await clickOption('winter')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_winter']])
    await wrapper.setProps({ modelValue: ['t_winter'] })
    expect(wrapper.find('[data-testid="selected-tag-t_winter"]').exists()).toBe(true)
  })

  it('removes a tag from the model when its chip is removed', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: ['t_winter'] } })
    await wrapper.find('[data-testid="remove-tag-t_winter"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('offers to create a tag with no existing match, and adds the created tag to the model', async () => {
    mutateAsync.mockResolvedValueOnce(created)
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    await wrapper.find('input').setValue('Sporting Goods')
    expect(document.body.textContent).toContain('Sporting Goods')

    await clickOption('Sporting Goods')
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: 'sporting goods' }))
    await vi.waitFor(() =>
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_sporting']])
    )
  })

  it('selects an existing tag instead of creating a duplicate when the normalised name matches', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [] } })
    // Nuxt UI's own suggestion filter does an exact substring match, so the
    // extra internal whitespace here means it does NOT recognise 'tax
    // records' as a match and offers the create affordance anyway — it's
    // TagPicker's own onCreate handler that must normalise, notice the
    // existing 'tax records' tag, and select it instead of creating a
    // duplicate.
    await wrapper.find('input').setValue('Tax   Records')
    await clickOption('Tax   Records')

    await vi.waitFor(() =>
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['t_tax_records']])
    )
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
