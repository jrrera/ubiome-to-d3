A small utility for converting uBiome's JSON data export into a 
user friendly tree graph.

Usage: 

The `ubiometree` function takes two arguments: 

- `dataLocation`: The location of the JSON file (e.g. /static/microbiome.json)
- `elementId`: The id selector of the element that should house the graph.

Example:

    // CommonJS / Browserify
    var d3 = require('d3');
    var ubiometree = require('./ubiome-d3-tree');
    ubiometree('static/microbiome.json', '#graph-div'); 

    // Non-CommonJS, use globals. Requires D3.
    ubiometree('static/microbiome.json', '#graph-div');

To view an example, first run `bower install`, fire up a local server 
(e.g. `python -m SimpleHTTPServer 8081`) and open `example/index.html`.

Questions? Issues? Let me know!