---
title: "GP Animation"
author: "Eugenio Mattei"
theme: ["parchment", "near-midnight", "alt", "wide"]
toc: false
---

<div class="hero">
  <h1>One base at the time</h1>
  <h2>Number of bases sequenced at the Broad Institute across the years.</h2>
</div>


<body>
<div class="summary">
This interactive animation illustrates the total number of bases sequenced by the <strong>Broad Genomics Platform</strong> across the years. Each bar is a different run type and the <i><strong>colors</strong></i> represent the different <i><strong>instrument models</i></strong>. Number of bases for each run type is expressed in <strong>Terabases!</strong>
</div>
</body>
<!-- Load and transform the data -->

```js
import { utcFormat } from "d3-time-format";
import {
  _axis, _labels, _bars, _ticker,
  rank_helper, keyframes_helper,
  get_colors,  get_chart_height 
} from "./components/utils.js";

const formatDate = utcFormat("%Y-%m-%d"); // Define the desired format

// Load the data
// Year, Month, Type, Model, PFBases
const data = await FileAttachment("./data/broad_sequencing_output_dataset.csv").csv({typed: true});

const duration = 25; // Making animation smooth.
const n=10; // Number of visible bars.
const k=20; // Interpolation values, help making transitions smooth.
const barSize=50;
const margin=({top: 15, right: 6, bottom: 6, left: 0});
const chartHeight=get_chart_height(margin, barSize, n);


const names = new Set(data.map(d => d.name));

// Transform the data to add a new "date" column
data.forEach(d => {
  d.date = `${formatDate(new Date(`${d.Year}, ${d.Month}, 1`))}`;
});


const datevalues = Array.from(
  d3.rollup(
    data,
    v => d3.sum(v, d => d.value || 0), // Reducer: Sum the `value` field
    d => d.date, // Group by date
    d => d.name  // Group by name
  )
)
  .map(([date, data]) => [
    new Date(date), // Convert date string to Date object
    new Map(data) // Convert nested Map to array
  ])
  .sort(([a], [b]) => d3.ascending(a, b)); // Sort by date

// Make the values cumulative
const cumulativeValues = new Map(); // To track cumulative sums for each name
// Ensure all names are present in every date's Map
for (const [[dateA, dataA], [dateB, dataB]] of d3.pairs(datevalues)) {
  // Get all unique names from both Maps
  const allNames = new Set([...dataA.keys(), ...dataB.keys()]);

  // Ensure all names are present in dataA
  allNames.forEach(name => {
    if (!dataA.has(name)) {
      dataA.set(name, 0); // Use the cumulative value or 0
    }
  });

  // Ensure all names are present in dataB
  allNames.forEach(name => {
    if (!dataB.has(name)) {
      dataB.set(name, 0); // Use the cumulative value or 0
    }
  });
}

datevalues.forEach(([date, data]) => {
  data.forEach((value, name) => {
    // Add the current value to the cumulative sum for this name
    const cumulativeValue = (cumulativeValues.get(name) || 0) + value;
    cumulativeValues.set(name, cumulativeValue); // Update the cumulative sum
    data.set(name, cumulativeValue); // Update the Map with the cumulative value
  });
});


const keyframes = keyframes_helper(datevalues, k, n, names);
const nameframes = d3.groups(keyframes.flatMap(([, data]) => data), d => d.name);
const prev = new Map(nameframes.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a])));
const next = new Map(nameframes.flatMap(([, data]) => d3.pairs(data)));

const color_map = get_colors(data);


```
<!-- Define the function drawing the svg -->

```js
async function* sequencingOutputAnimation({width} = {}, height, keyframes, duration, barSize, n, margin, color_map)
{
  const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height]);
  
  const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);
  /*const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right])
              .interpolate((a, b) => t => a + (b - a) * Math.sqrt(t)); // Square root interpolation*/

  const y = d3.scaleBand()
    .domain(d3.range(n + 1))
    .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
    .padding(0.1);

  const updateBars = _bars(svg);
  const updateAxis = _axis(svg, x, y, n, width, barSize, margin);
  const updateLabels = _labels(svg);
  const updateTicker = _ticker(svg, keyframes, width, margin, barSize, n);

  

  yield svg.node();
  
  for (const keyframe of keyframes) {
    const transition = svg.transition()
                          .duration(duration)
                          .ease(d3.easeLinear);

    x.domain([0, keyframe[1][0].value]);

    updateAxis(keyframe, transition);
    updateBars(keyframe, transition, n, x, y, prev, next, color_map);
    updateLabels(keyframe, transition, n, x, y, prev, next);
    updateTicker(keyframe, transition);

    invalidation.then(() => svg.interrupt());
    await transition.end();
  }
}
```
<!-- This is where the function is called and the animation start -->

```js
const container = document.querySelector(".card");

const nodeGenerator = sequencingOutputAnimation({width}, chartHeight, keyframes, duration, barSize, n, margin, color_map);

(async () => {
  container.innerHTML = ""; // Clean plot area.
  for await (const node of nodeGenerator) {
    container.appendChild(node);
  }
})();

````

<div class="card"></div>
<div class="grid grid-cols-2">
  <div class="card">Data: <a href="https://www.broadinstitute.org/reading-and-editing-biology/genomics-platform">Broad Genomics Platform.</a></div>
  <div class="card">Modified from Observable <a href="https://observablehq.com/@d3/bar-chart-race">Bar Race Chart.</a></div>
</div>


<style>

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--sans-serif);
  margin: 4rem 0 8rem;
  text-wrap: balance;
  text-align: center;
}

.hero h1 {
  margin: 1rem 0;
  padding: 1rem 0;
  max-width: none;
  font-size: 14vw;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(30deg, var(--theme-foreground-focus), currentColor);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero h2 {
  margin: 0;
  max-width: 34em;
  font-size: 20px;
  font-style: initial;
  font-weight: 500;
  line-height: 1.5;
  color: var(--theme-foreground-muted);
}

.summary{
  font-size: 20px;
  font-weight: 500;
}

@media (min-width: 640px) {
  .hero h1 {
    font-size: 90px;
  }
}

</style>
