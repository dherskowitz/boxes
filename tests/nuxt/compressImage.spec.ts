import { beforeEach, describe, expect, it, vi } from 'vitest'

const compressMock = vi.fn()
vi.mock('browser-image-compression', () => ({ default: compressMock }))

const { compressImage, compressImages } = await import('~/utils/compressImage')

function fakeFile(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

describe('compressImage', () => {
  beforeEach(() => {
    compressMock.mockReset()
    compressMock.mockImplementation((file: File) => Promise.resolve(file))
  })

  it('caps the long edge and the file size', async () => {
    await compressImage(fakeFile('coat.jpg', 4_000_000))
    expect(compressMock).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ maxWidthOrHeight: 1600, maxSizeMB: 1, useWebWorker: true })
    )
  })

  it('keeps the original filename so uploads stay recognisable', async () => {
    compressMock.mockResolvedValue(new File([new Uint8Array(10)], 'blob', { type: 'image/jpeg' }))
    const out = await compressImage(fakeFile('winter-coat.jpg', 4_000_000))
    expect(out.name).toBe('winter-coat.jpg')
  })

  it('compresses every file it is given', async () => {
    await compressImages([fakeFile('a.jpg', 100), fakeFile('b.jpg', 100)])
    expect(compressMock).toHaveBeenCalledTimes(2)
  })

  it('returns an empty list unchanged without calling the library', async () => {
    expect(await compressImages([])).toEqual([])
    expect(compressMock).not.toHaveBeenCalled()
  })
})
