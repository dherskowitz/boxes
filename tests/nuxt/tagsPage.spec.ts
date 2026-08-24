import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TagsPage from '~/pages/tags.vue'
import type { StorageTag } from '~/types/pocketbase'

const kitchen: StorageTag = {
  id: 't_kitchen',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z',
  name: 'kitchen',
  color: '#16a34a',
  created_by: 'u_dana'
}

const { updateMutateAsync, deleteMutateAsync } = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn()
}))

mockNuxtImport('useTags', () => {
  return () => ({
    data: ref([kitchen]),
    isPending: ref(false),
    isError: ref(false),
    error: ref(null),
    refetch: vi.fn()
  })
})

mockNuxtImport('useTagUsageMap', () => {
  return () => computed(() => new Map())
})

mockNuxtImport('useAuth', () => {
  return () => ({ role: ref('owner') })
})

mockNuxtImport('useUpdateTag', () => {
  return () => ({ mutateAsync: updateMutateAsync, isPending: ref(false) })
})

mockNuxtImport('useDeleteTag', () => {
  return () => ({ mutateAsync: deleteMutateAsync, isPending: ref(false) })
})

describe('tags.vue — inline edit', () => {
  afterEach(() => {
    updateMutateAsync.mockClear()
    deleteMutateAsync.mockClear()
  })

  it('refuses to save a rename that normalises to empty, and does not call the API', async () => {
    const wrapper = await mountSuspended(TagsPage)
    await wrapper.find('[data-testid="rename-tag-kitchen"]').trigger('click')
    await wrapper.find('input[type="text"]').setValue('   ')
    // Submit the form, not the button: happy-dom does not synthesise a submit
    // event from a click on a type="submit" button, and the rename row is a
    // UForm now — clicking Save here would assert nothing.
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Tag name cannot be empty.'))

    expect(updateMutateAsync).not.toHaveBeenCalled()
  })

  it('saves a normalised, non-empty rename', async () => {
    updateMutateAsync.mockResolvedValueOnce({ ...kitchen, name: 'kitchenware' })
    const wrapper = await mountSuspended(TagsPage)
    await wrapper.find('[data-testid="rename-tag-kitchen"]').trigger('click')
    await wrapper.find('input[type="text"]').setValue('  Kitchenware  ')
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: 't_kitchen',
        name: 'kitchenware',
        color: '#16a34a'
      })
    )
  })

  it('saves a colour chosen on the same row, alongside the name', async () => {
    updateMutateAsync.mockResolvedValueOnce({ ...kitchen, color: '#dc2626' })
    const wrapper = await mountSuspended(TagsPage)
    await wrapper.find('[data-testid="rename-tag-kitchen"]').trigger('click')
    await wrapper.find('input[type="color"]').setValue('#dc2626')
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: 't_kitchen',
        name: 'kitchen',
        color: '#dc2626'
      })
    )
  })
})
