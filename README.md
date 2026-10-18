# Search & the Vote

A static MVP for exploring **statewide presidential election results alongside Google Trends search interest**. It runs entirely in the browser and can be hosted for free on GitHub Pages or Vercel.

## What is included

- Interactive map of 50 states and DC, with a state picker for small regions.
- Election choices for 2008, 2012, 2016, 2020, and 2024. Each choice opens Google Trends using the exact inauguration-to-inauguration date window requested.
- 2024 Democratic, Republican, and other vote percentages from the supplied `Political Data Donovan and Sohan Project(2024).csv` (converted to `data/election-2024.json`). Earlier years show statewide winners only.
- Import of a **Google Trends “Interest by region” CSV** for one term and one election window. Uploaded values are saved in the current browser and can be viewed as a search-interest map, in state detail, and as averages for Democratic-won versus Republican-won states.

## Try it locally

From this directory:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Opening `index.html` directly as a local file will block the JSON fetch in many browsers.

## Add search data

1. Pick an election and enter one term, such as `zombie`.
2. Click **Open Google Trends**. The link includes `geo=US` and the selected date window.
3. In Google Trends, find **Interest by region**, choose the **Subregion** view if needed, and download its CSV.
4. Upload that CSV in the app. The app checks the term and dates when they appear in the CSV header. Export each term/year separately.

Entering a term opens the matching Google Trends page. The map shows the **combined view** after its regional CSV is uploaded: blue/red indicate the statewide election winner, and darker shades indicate higher search interest. Without that CSV, the app has no search-interest values to map.

Google Trends values are relative search-interest scores (0–100), not counts. The comparison uses an **unweighted mean of state scores** by statewide winning party. It does not show how individual voters searched or voted, and it cannot establish causation.

Google's [Trends API is currently an access-limited alpha](https://developers.google.com/search/apis/trends), so automatic arbitrary-term retrieval is outside this free static MVP. CSV export is supported by [Google Trends](https://support.google.com/trends/answer/4365538?hl=en).

## Free deployment

**GitHub Pages:** Create a repository, add these files to its root, and push to `main`. In the repository's **Settings → Pages**, choose **Deploy from a branch**, `main`, and `/ (root)`. The site will be at `https://<username>.github.io/<repository>/`. The included `.nojekyll` keeps GitHub Pages from applying Jekyll.

**Vercel:** Import the same Git repository as a project. Select **Other** framework, leave the build command empty, and set the output directory to the repository root. No server, API key, environment variable, or paid plan is needed for this static MVP.

## Data provenance

- `data/election-2024.json`: converted from the user-provided project CSV, including all 50 states and DC. The source did not include a citation or prior years' vote shares; confirm its provenance before publishing research claims.
- 2008–2020 statewide winners: [National Archives Electoral College election results](https://www.archives.gov/electoral-college/results). Maine and Nebraska use their statewide winner, even when district electoral votes split.
- `data/state-paths.json`: generated from [US Census Bureau 2024 cartographic state boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html) at 1:20m resolution. Alaska and Hawaii are shifted into map insets.

Regenerate the two JSON files with `python3 scripts/build_data.py '/path/to/Political Data Donovan and Sohan Project(2024).csv' '/path/to/cb_2024_us_state_20m.zip'`.

## Checks

Run `node --test tests/*.test.js` and `node --check app.js`.
