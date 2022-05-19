<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudForest Visualizations</title>  
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>

<body style="display: none;">
    <div class="section">
        <div class="container">
            <nav class="navbar is-spaced is-light" role="navigation" aria-label="main navigation">
                <div class="navbar-brand">
                    <h1 class="title">CloudForest</h1>
                </div>
                <div class="navbar-menu is-active">
                    <div class="navbar-start">
                        <a id="documentation-btn" class="button is-light">
                            Documentation
                        </a>
                        <a class="button is-light" href="#" target="_blank">
                            Full Screen
                        </a>
                    </div>
                </div>
            </nav>
            <div class="navbar" id="navbar-version-banner">
            </div>
        </div>
    </div>

    <div class="section">
        <div class="container">
            <div class="tile is-ancestor">
                <div class="tile is-parent">
                    <div class="tile is-child box">
                        <h5>Visualization</h5>
                        <div class="tile is-vertical is-parent">
                            <div class="control">
                                <div class="select">
                                    <div id ="viz-interface">
                                        <select id="visualization-select" class="is-small" disabled>
                                            <option value="">--Please choose a visualization--</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tile is-child box">
                        <h5>Files</h5>
                        <div class="tile is-vertical is-parent">
                            <div class="control">
                                <div class="select">
                                    <div id ="file-select-menu">
                                        <select id="file-select" class="is-small" disabled>
                                            <option value="">--Please choose a file--</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div><!-- END menu ancestor tile -->
            
            <div class="tile is-ancestor">
                <div class="tile is-vertical is-parent">
                    <div id="plot-metadata"></div>
                    <div id="plot-controls"></div>
                </div>
            </div>
           
            <div class="tile is-ancestor">
                <div class="tile box has-text-centered" style="overflow-x: auto;">
                    <div id="plot" style="width: 100%; margin: 0 auto, font-size:0;"></div>
                </div>
            </div>
            <div class="tile is-ancestor">
                <div id="subset-plots-div"/>
            </div>
        </div> <!-- Container-->
    </div>
    
    <div id="galaxy-config" href="${h.url_for('', qualified=True)}" history-id="${trans.security.encode_id( hda.history_id )}"></div>
    <script src="/static/plugins/visualizations/cloudforest/static/bundle-@VISUALIZATION_VERSION_REPLACE@.js"></script>
</body>


</html>
