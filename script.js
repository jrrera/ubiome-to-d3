(function () {

var realWidth = window.innerWidth;
var realHeight = window.innerHeight;
var m, w, h, i, root, tree, diagonal, vis;

window.addEventListener('resize', resize);

/**
 * Exposed method for setting up the graph. 
 *
 * @param {string} dataLocation Where to make the HTTP request for JSON.
 * @param {string} elementId The div to build on (e.g. '#inner').
 */
function load(dataLocation, elementId) {
  margins = [60, 60, 60, 60];
  w = realWidth - margins[1] - margins[3];
  h = realHeight - margins[0] - margins[2];
  i = 0;

  // Height of 2.5x allows you to zoom around with less cramping.
  tree = d3.layout.tree()
      .size([h * 2.5, w]).
      separation(function separation(a, b) {
        return a.parent == b.parent ? 1 : 2;
      });

  diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

  vis = d3.select(elementId).append("svg:svg")
      .attr("viewBox", "0 0 " + w + " " + h)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class","svg_container")
      .style("overflow", "scroll")
    .append("svg:g")
       .attr("class","drawarea")
    .append("svg:g")
      .attr("transform", "translate(" + margins[3] + "," + margins[0] + ")");

  d3.json(dataLocation, function(json) {
    root = processMicrobiome(json);
    root.x0 = h / 2;
    root.y0 = 0;
    update(root);
  });

  // Set up zoom behavior.
  d3.select("svg")
      .call(d3.behavior.zoom()
          .scaleExtent([0.5, 5])
          .on("zoom", zoom));
}


/**
 * Updates the graph in response to data or events
 *
 * @param {Object} source Data structure for graph to work with. Can be the
 *     root or any node with children.
 */
function update(source) {
  var duration = d3.event && d3.event.altKey ? 5000 : 500;

  // Compute the new tree layout. Null children prop yields leaf nodes.
  var nodes = tree.nodes(root).reverse();

  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 180; });

  // Update the nodes
  var node = vis.selectAll("g.node")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });

  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("svg:g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", function(d) { toggle(d); update(d); });

  nodeEnter.append("svg:circle")
      .attr("r", 1e-6)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

  nodeEnter.append("svg:text")
      .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
      .attr("y", function(d) {
        // Spread out the labels a bit by adjusting by odds and evens.
        return d.taxon % 2 === 0 && (d.children || d.children_) ? 5 : -5;
      })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
      .text(function(d) { return d.label; })
      .style("fill-opacity", 1e-6);

  // Transition nodes to their new position.
  var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

  nodeUpdate.select("circle")
      .attr("r", 4.5)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links
  var link = vis.selectAll("path.link")
      .data(tree.links(nodes), function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  link.enter().insert("svg:path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      })
    .transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition links to their new position.
  link.transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}


/**
 * Toggles children on and off in the graph.
 * 
 * @param {Object} d Node data.
 */
function toggle(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}


/**
 * Toggles entire graph starting from passed into root.
 * 
 * @param {Object} d Node data.
 */
function toggleAll(d) {
  if (d.children) {
    d.children.forEach(toggleAll);
    toggle(d);
  }
}


/**
 * Traverse uBiome JSON data; convert into nested data structure.
 * 
 * @param {Object} data The parsed uBiome data export.
 * @return {Object} root The nested data structure for D3 to use.
 */
function processMicrobiome(data) {
 var referenceDict = {}; // Store entries as key value pairs
 var microbiomeArr = data.ubiome_bacteriacounts; // Shorthand var.
 var root;
 var totalCount;
 
 // Add each node to the dict using taxon ID as key
 microbiomeArr.forEach(function(species) {
   referenceDict[species.taxon] = species;
 });

 root = referenceDict[1];
 totalCount = root.count;
 
 // Put each element in its place by parent and add ratio to total property
 microbiomeArr.forEach(function(species) {
   var parentId = species.parent;
   var parent = referenceDict[parentId];
   
   if (parent) {
     parent.children = parent.children || [];
     parent.children.push(species);
   }
   
   species.percentOfTotal = (species.count / totalCount) * 100;
   species.label = species.tax_name + ': ' + species.percentOfTotal.toFixed(2) + '%';
   
 });
 
 return root;
}


/**
 * Responds to window resizing.
 */
function resize() {
  var svg = d3.select("svg:svg"),
      width = window.innerWidth,
      height = window.innerHeight;

  svg.attr("viewBox", "0 0 " + width + " " + height);
}


/**
 * Translate draw area based on zoom events.
 */
function zoom() {
  d3.select(".drawarea")
      .attr("transform", "translate(" + d3.event.translate + ")" +
            " scale(" + d3.event.scale + ")");
}


// CommonJS support
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = load;
  }
  exports.load = load;
} else {
  window.ubiometree = load;
}


})(); // IIFE