# Mobile

Viewports below 1366px, including phones and tablets, use one phone shell. The desktop sidebar is not mounted.

## Navigation

The bottom bar has Home (`/cards`), CardHolder (`/cardholder`), a center camera (`/scan`), Tools (`/tools`), and Settings (`/settings`). The bar is hidden on the camera screen and on a cardholder detail route so the page can use the full height. `viewport-fit=cover` keeps the bar clear of the home indicator.

## Cardholder

The list is an infinite query of 24 contacts per page, virtualized by scroll position, with date headings in Asia/Shanghai. Favorite, note, and delete update the visible rows immediately and then confirm with the API. A failure rolls the row back. The same contact id is used on desktop.

## Scan

The camera screen uploads to `POST /scans`. High accuracy sends language `eng+chi_sim`. Basic sends `eng`. Both use the same recognize pipeline as desktop. A pending review count opens the same review step.

## Sync

Home counts, the cardholder, detail, scan review, and organization settings refetch every 4 seconds. A phone mutation also invalidates the desktop cardholder cache.
