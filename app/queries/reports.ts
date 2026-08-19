/**
 * Reporting queries over the `storage_report_*` view collections.
 *
 * Owned by the reporting slice. Aggregation happens in PocketBase — these views
 * return tens of rows. Never fetch full record sets and reduce them here.
 */
export {}
