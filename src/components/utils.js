// This file contains utility functions for the D3.js visualization.
import * as d3 from "d3";
import { utcFormat } from "d3-time-format";

const formatDate = utcFormat("%Y-%m-%d"); // Define the desired format
const formatNumber = d3.format(",d");

export function get_chart_height(margin, barSize, n) {
  return (
    margin.top + barSize * n + margin.bottom
  )
}

export function rank_helper(value, n, names) {
  //console.log("names:", names);
  if (!names || typeof names[Symbol.iterator] !== "function") {
    throw new TypeError("The 'names' argument must be an iterable");
  }

  const data = Array.from(names, name => ({ name, value: value(name) }));
  data.sort((a, b) => d3.descending(a.value, b.value));
  for (let i = 0; i < data.length; ++i) {
    data[i].rank = Math.min(n, i);
  }
  return data;
}

export function keyframes_helper(datevalues, k, n, names) {
  const keyframes = [];
  let ka, a, kb, b;
  for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
    for (let i = 0; i < k; ++i) {
      const t = i / k;
      keyframes.push([
        formatDate(new Date(ka * (1 - t) + kb * t)),
        rank_helper(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t, n, names)
      ]);
    }
  }
  keyframes.push([formatDate(new Date(kb)), rank_helper(name => b.get(name) || 0, n, names)]);
  return keyframes;
}

export function _axis(svg, x, y, n, width, barSize, margin) {
  const g = svg.append("g")
    .attr("transform", `translate(0, ${margin.top})`);

  const axis = d3.axisTop(x)
    .ticks(width / 160)
    .tickSizeOuter(0)
    .tickSizeInner(-barSize * (n + y.padding()));

  return (_, transition) => {
    g.transition(transition).call(axis);
    g.select(".tick:first-of-type text").remove();
    g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
    // Style the tick labels (change font size here)
    g.selectAll(".tick text")
      .style("font-size", "14px") // Adjust the font size
      .style("font-weight", "bold") // Make the text bold
      .style("font-family", "sans-serif"); // Optionally set the font family

    g.select(".domain").remove();
  };
}

export function _bars(svg) {
  let bar = svg.append("g")
    .attr("fill-opacity", 0.6)
    .selectAll("rect");

  return ([date, data], transition, n, x, y, prev, next, color_map) => bar = bar
    .data(data.slice(0, n), d => d.name)
    .join(
      enter => enter.append("rect")
        .attr("fill", color_map)
        .attr("height", y.bandwidth())
        .attr("x", x(0))
        .attr("y", d => y((prev.get(d) || d).rank))
        .attr("width", d => x((prev.get(d) || d).value) - x(0)),
      update => update,
      exit => exit.transition(transition).remove()
        .attr("y", d => y((next.get(d) || d).rank))
        .attr("width", d => x((next.get(d) || d).value) - x(0))
    )
    .call(bar => bar.transition(transition)
      .attr("y", d => y(d.rank))
      .attr("width", d => x(d.value) - x(0)));
}

export function _labels(svg) {
  let label = svg.append("g")
    .style("font", "bold 20px var(--sans-serif)")
    .style("font-variant-numeric", "tabular-nums")
    .attr("text-anchor", "end")
    .selectAll("text");

  return ([date, data], transition, n, x, y, prev, next) => label = label
    .data(data.slice(0, n), d => d.name)
    .join(
      enter => enter.append("text")
        .attr("y", y.bandwidth() / 2)
        .attr("x", -6)
        .attr("dy", "-0.25em")
        .text(d => d.name)
        .call(text => text.append("tspan")
          .attr("fill-opacity", 0.7)
          .attr("font-weight", "normal")
          .attr("x", -6)
          .attr("dy", "1.15em")),
      update => update,
      exit => exit.transition(transition).remove()
        .attr("transform", d => `translate(${x((next.get(d) || d).value)},${y((next.get(d) || d).rank)})`)
        .call(g => g.select("tspan")
          .textTween((d) => d3.interpolateRound(d.value, (next.get(d) || d).value))
        )
    )
    .call(bar => bar.transition(transition)
      .attr("transform", d => `translate(${x(d.value)},${y(d.rank)})`)
      .attr("x", function(d){
        const textWidth = this.getComputedTextLength();
        const xPos = x(d.value);
        if (xPos < textWidth) {
          return 6;
        }
        return -6;
       }
      )
      .attr("text-anchor", function(){
        // Retrieve the x value of the parent <text> element
        const parentX = d3.select(this).attr("x");
        return parentX > 0 ? "start" : "end"; // Convert to a number and default to 0 if undefined
      })
      .attr("fill", function(){
        // Retrieve the x value of the parent <text> element
        const parentX = d3.select(this).attr("x");
        return parentX > 0 ? "var(--theme-foreground)" : "var(--theme-foreground-focus-alt)"; // Change color dynamically
      })
      .call(g => g.select("tspan")
        .textTween((d) => (t) => formatNumber(
          d3.interpolateNumber((prev.get(d) || d).value, d.value)(t)
        ))
        .attr("x", function(d){
          // Retrieve the x value of the parent <text> element
          const parentX = d3.select(this.parentNode).attr("x");
          return parentX ? +parentX : 0; // Convert to a number and default to 0 if undefined
        })
        .attr("text-anchor", function(){
          // Retrieve the x value of the parent <text> element
          const parentX = d3.select(this).attr("x");
          return parentX > 0 ? "start" : "end"; // Convert to a number and default to 0 if undefined
        })
        .attr("fill", function(){
          // Retrieve the x value of the parent <text> element
          const parentX = d3.select(this.parentNode).attr("x");
          return parentX > 0 ? "var(--theme-foregorund)" : "var(--theme-foreground-focus-alt)"; // Change color dynamically
        })
      )
    )
}

export function _ticker(svg, keyframes, width, margin, barSize, n) {
  const _formatDate = d3.utcFormat("%b %Y");

  const getColorFromDocument = getComputedStyle(document.documentElement)
    .getPropertyValue("--theme-foreground")
    .trim(); // Remove any extra whitespace

  const now = svg.append("text")
    .style("font", `bold ${barSize - 20}px var(--sans-serif)`)
    .style("font-variant-numeric", "tabular-nums")
    .attr("fill", getColorFromDocument)
    .attr("text-anchor", "end")
    .attr("x", width - 6)
    .attr("y", margin.top + barSize * (n - 0.45))
    .attr("dy", "0.32em")
    .text(_formatDate(new Date(keyframes[0][0])));

  return ([date], transition) => {
    transition.end().then(() => now.text(_formatDate(new Date(date))));
  };
}

export function get_colors(data) {
  const scale = d3.scaleOrdinal(d3.schemeTableau10);
  if (data.some(d => d.category !== undefined)) {
    const categoryByName = new Map(data.map(d => [d.name, d.category]))
    scale.domain(Array.from(categoryByName.values()));
    return d => scale(categoryByName.get(d.name));
  }
  return d => scale(d.name);
}

