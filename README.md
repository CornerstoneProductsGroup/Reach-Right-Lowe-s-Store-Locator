# Reach Right Lowe's Store Locator

A lightweight, Netlify-ready web app to help customers find nearby Lowe's stores carrying Reach Right USA.

## What this app does

- Accepts a customer ZIP code and search radius in miles.
- Uses your approved Lowe's store list from `data/lowes-store-directory.json`.
- Shows nearby stores sorted by distance.
- Plots customer search center and nearby stores on an interactive map.
- Lets you export nearby results as CSV.

## Quick start

1. Open `index.html` locally, or deploy this repo to Netlify.
2. Enter ZIP code and select a radius in miles.
3. Click **Find Stores**.
4. Review nearby stores and optionally export CSV.

## Data format

The file `data/lowes-store-directory.json` should use this structure:

```json
{
	"1234": {
		"name": "Lowe's Home Improvement",
		"address": "123 Example St, Raleigh, NC 27601",
		"lat": 35.7796,
		"lng": -78.6382
	}
}
```

Notes:

- Key = Lowe's store number as text.
- Include `lat` and `lng` if you already know coordinates.
- Best performance comes from including `lat` and `lng` for each store.

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify, choose **Add new site** -> **Import from Git**.
3. Select this repository.
4. Build command: leave empty.
5. Publish directory: `.`
6. Deploy.

No framework or build step is required.

## Optional: bulk-generate directory from store numbers

If you have a plain list of store numbers, put them in `store-numbers.txt` and run:

```bash
node scripts/generate-store-directory.mjs store-numbers.txt
```

This appends found stores to `data/lowes-store-directory.json`.