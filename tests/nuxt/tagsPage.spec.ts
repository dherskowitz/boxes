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

const { renameMutateAsync, deleteMutateAsync } = vi.hoisted(() => ({
  renameMutateAsync: vi.fn(),
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

mockNuxtImport('useTagUsage', () => {
  return () => computed(() => new Map())
})

mockNuxtImport('useAuth', () => {
  return () => ({ role: ref('owner') })
})

mockNuxtImport('useRenameTag', () => {
  return () => ({ mutateAsync: renameMutateAsync, isPending: ref(false) })
})

mockNuxtImport('useDeleteTag', () => {
  return () => ({ mutateAsync: deleteMutateAsync, isPending: ref(false) })
})

describe('tags.vue — inline rename', () => {
  afterEach(() => {
    renameMutateAsync.mockClear()
    deleteMutateAsync.mockClear()
  })

  it('refuses to save a rename that normalises to empty, and does not call the API', async () => {
    const wrapper = await mountSuspended(TagsPage)
    await wrapper.find('[data-testid="rename-tag-kitchen"]').trigger('click')
    await wrapper.find('input').setValue('   ')
    await wrapper.findAll('button').find(b => b.text() === 'Save')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Tag name cannot be empty.'))

    expect(renameMutateAsync).not.toHaveBeenCalled()
  })

  it('saves a normalised, non-empty rename', async () => {
    renameMutateAsync.mockResolvedValueOnce({ ...kitchen, name: 'kitchenware' })
    const wrapper = await mountSuspended(TagsPage)
    await wrapper.find('[data-testid="rename-tag-kitchen"]').trigger('click')
    await wrapper.find('input').setValue('  Kitchenware  ')
    await wrapper.findAll('button').find(b => b.text() === 'Save')?.trigger('click')

    await vi.waitFor(() =>
      expect(renameMutateAsync).toHaveBeenCalledWith({ id: 't_kitchen', name: 'kitchenware' })
    )
  })
})
