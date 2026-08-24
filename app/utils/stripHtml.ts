/**
 * The readable text of an `editor` field.
 *
 * `storage_boxes.description`, `storage_items.description` and `notes` are
 * PocketBase `editor` fields, so they hold HTML. Searching them matches the
 * markup as well as the words — a term like "div" or "href" hits every record
 * with a paragraph in it, and none of those matches is visible to the reader.
 *
 * Used to decide what a search can honestly claim it matched, not to sanitise
 * anything: nothing here is ever inserted back into the DOM. Tag contents are
 * kept and the tags themselves dropped, with a space in their place so
 * `<p>one</p><p>two</p>` does not read as "onetwo" — the same trap a `<br>`
 * sets for `textContent`.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    // Entities the editor emits for characters that would otherwise be markup.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
