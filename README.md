# CloudForest Visualization

This project can be built and packaged in a single command:

```$ npm run package```

This generates `cloudforest.tar.gz`, which is used by the [CloudforestDocker](https://github.com/TreeScaper/CloudforestDocker/) project to generate a CloudForest image.

## Dev Dependencies: Webpack
Webpack is used to package the JS, HTML and CSS into a distribution. Webpack is also used to tree-shake the d3 code down to a smaller distribution.

## Production Dependencies: D3.js and plotly.js
The visualization code depends in D3 and Plotly.
