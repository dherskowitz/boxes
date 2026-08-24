import { describe, expect, it } from 'vitest'
import { stripHtml } from '~/utils/stripHtml'

describe('stripHtml', () => {
  it('leaves plain text alone', () => {
    expect(stripHtml('Torch, batteries and a camp stove.')).toBe('Torch, batteries and a camp stove.')
  })

  it('drops the tags and keeps what they wrapped', () => {
    expect(stripHtml('<p>Torch and <strong>batteries</strong></p>')).toBe('Torch and batteries')
  })

  it('puts a space where a tag was, so two blocks do not run together', () => {
    // The `<br>` trap: a tag contributes no whitespace of its own, so
    // "<p>one</p><p>two</p>" would otherwise read as "onetwo" and match a
    // term that appears in neither paragraph.
    expect(stripHtml('<p>camp</p><p>stove</p>')).toBe('camp stove')
  })

  it('decodes the entities the editor writes for markup characters', () => {
    expect(stripHtml('<p>Tent&nbsp;poles &amp; pegs</p>')).toBe('Tent poles & pegs')
  })

  it('leaves nothing behind for markup with no text in it', () => {
    // This is the case the search cares about: "div" must not be reported as
    // a description match.
    expect(stripHtml('<div></div>')).toBe('')
  })

  it('collapses the run of spaces the tag removal leaves', () => {
    expect(stripHtml('<ul> <li>one</li>  <li>two</li> </ul>')).toBe('one two')
  })

  it('handles an empty field', () => {
    expect(stripHtml('')).toBe('')
  })
})
