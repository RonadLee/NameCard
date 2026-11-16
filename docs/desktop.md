# Desktop

The desktop layout is used when the viewport is at least 1366px wide. Widths 1366, 1440, 1600, and 1920 stay on this layout.

## Navigation

The console covers My Cards, Email Signature, Virtual Background, and Settings. Cardholder is its own workspace at `/cardholder`, with its own list, filters, and detail. It is not a panel inside the console sidebar.

## Cardholder

The list is paged (`pageSize` up to 100) and virtualized. Search, group, and scope (`mine` or the company directory) are query parameters on `GET /contacts`. Opening a row shows the detail beside the filtered list. Editing opens the card editor. Favorite, note, group, and delete write through the same contact API the phone layout uses.

Create and edit accept a required front image and an optional back image. The existing OCR pipeline fills the form. Saving stores one contact. Categorize adds group membership. Deleting a group asks for confirmation when contacts still belong to it.

## Sync

After a mutation the desktop list invalidates the phone list cache. While the screen is open it also refetches every 4 seconds, so a change made on a phone appears without a reload.
