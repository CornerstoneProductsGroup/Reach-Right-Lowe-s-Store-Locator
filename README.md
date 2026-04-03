# Reach Right Lowe's Store Locator

A lightweight, Netlify-ready web app to map Lowe's stores that carry Reach Right USA.

## What this app does

- Accepts a list of Lowe's store numbers.
- Looks up matching addresses from a local directory file when available.
- Tries OpenStreetMap lookup for missing store numbers.
- Plots matched stores on an interactive map.
- Lets you export mapped results as CSV.

## Quick start

1. Open `index.html` locally, or deploy this repo to Netlify.
2. Paste store numbers into the input box (one per line or comma-separated).
3. Click **Map Stores**.
4. Review unresolved stores and add them to `data/lowes-store-directory.json` for exact matching.

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
- If coordinates are missing, the app geocodes from the address.

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