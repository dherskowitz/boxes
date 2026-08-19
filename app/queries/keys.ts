import type { BoxStatus } from '~/types/pocketbase'

/** Page size for every paginated list. Lives here, not in a query module, so
 *  no slice has to import across another slice's file to paginate. */
export const PER_PAGE = 30

export interface BoxListFilters {
  /** Omit to show only active boxes. */
  status?: BoxStatus
  /** Tag ids; a box matches if it carries all of them. */
  tagIds?: string[]
  search?: string
  page?: number
}

export interface ItemListFilters {
  boxId: string
  tagIds?: string[]
  page?: number
}

export interface SearchFilters {
  term: string
  tagIds?: string[]
}

export const keys = {
  boxes: {
    all: ['boxes'] as const,
    list: (filters: BoxListFilters = {}) => ['boxes', 'list', filters] as const,
    byQrId: (qrId: string) => ['boxes', 'qr', qrId] as const,
    byId: (id: string) => ['boxes', 'id', id] as const
  },
  items: {
    all: ['items'] as const,
    list: (filters: ItemListFilters) => ['items', 'list', filters] as const,
    byId: (id: string) => ['items', 'id', id] as const
  },
  comments: {
    all: ['comments'] as const,
    byItem: (itemId: string) => ['comments', 'item', itemId] as const
  },
  tags: {
    all: ['tags'] as const,
    list: () => ['tags', 'list'] as const
  },
  permissions: {
    all: ['permissions'] as const,
    byBox: (boxId: string) => ['permissions', 'box', boxId] as const
  },
  appUsers: {
    all: ['appUsers'] as const,
    list: () => ['appUsers', 'list'] as const,
    byId: (userId: string) => ['appUsers', 'id', userId] as const
  },
  search: {
    all: ['search'] as const,
    query: (filters: SearchFilters) => ['search', filters] as const
  },
  reports: {
    all: ['reports'] as const,
    boxFill: () => ['reports', 'boxFill'] as const,
    tagUsage: () => ['reports', 'tagUsage'] as const,
    growth: () => ['reports', 'growth'] as const
  }
} as const
