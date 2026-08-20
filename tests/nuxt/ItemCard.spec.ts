import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ItemCard from '~/components/ItemCard.vue'
import type { StorageBox, StorageItem } from '~/types/pocketbase'

const winterCoats: StorageBox = {
  id: 'b_winter',
  created: '2026-01-01 00:00:00Z',
  updated: '2026-01-01 00:00:00Z',
  title: 'Winter coats and boots',
  description: '',
  location: 'Garage shelf A3',
  images: [],
  qr_id: 'seedbox1',
  status: 'active',
  tags: [],
  created_by: 'u_dana'
}

const peacoat: StorageItem = {
  id: 'i_peacoat',
  created: '2026-01-02 00:00:00Z',
  updated: '2026-01-02 00:00:00Z',
  box: 'b_winter',
  title: 'Navy wool peacoat',
  description: 'Size M, from the Boston winters',
  notes: 'Dry clean before wearing',
  images: [],
  tags: [],
  created_by: 'u_dana',
  expand: { box: winterCoats }
}

describe('ItemCard', () => {
  it('shows which box the item is in when asked to', async () => {
    const card = await mountSuspended(ItemCard, { props: { item: peacoat, showBox: true } })
    expect(card.text()).toContain('Navy wool peacoat')
    expect(card.find('[data-testid="item-card-box"]').text()).toContain('Winter coats and boots')
  })

  // Box detail already knows which box it is showing; repeating it on every
  // row there would be noise.
  it('does not show the box by default', async () => {
    const card = await mountSuspended(ItemCard, { props: { item: peacoat } })
    expect(card.text()).toContain('Navy wool peacoat')
    expect(card.find('[data-testid="item-card-box"]').exists()).toBe(false)
    expect(card.text()).not.toContain('Winter coats and boots')
  })

  // An unexpanded relation must not render an empty "In" with nothing after it.
  it('shows nothing when asked for a box the record did not expand', async () => {
    const unexpanded: StorageItem = { ...peacoat, expand: undefined }
    const card = await mountSuspended(ItemCard, { props: { item: unexpanded, showBox: true } })
    expect(card.find('[data-testid="item-card-box"]').exists()).toBe(false)
  })

  // A box with no title falls back to its qr_id, as every other surface does.
  it('falls back to the qr id when the box has no title', async () => {
    const untitled: StorageItem = {
      ...peacoat,
      expand: { box: { ...winterCoats, title: '' } }
    }
    const card = await mountSuspended(ItemCard, { props: { item: untitled, showBox: true } })
    expect(card.find('[data-testid="item-card-box"]').text()).toContain('seedbox1')
  })
})
