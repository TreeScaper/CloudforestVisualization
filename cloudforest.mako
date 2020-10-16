<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudForest Visualizations</title>  
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
        </div>
    </div>

    <div class="section">
        <div class="container">
            <div class="tile is-ancestor">
                <div class="tile is-parent">
                    <div class="tile is-child box">
                        <h5>NLDR</h5>
                        <div class="tile is-vertical is-parent">
                            <div class="control">
                                <div class="select">
                                    <select id="nldr-select" class="is-small" disabled>
                                     <option value="">--Please choose a file--</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tile is-child box">
                        <h5>Trees and Matrices</h5>
                        <div class="tile is-vertical is-parent">
                            <div class="control">
                                <div class="select">
                                    <select id="tree-select" class="is-small" disabled>
                                     <option value="">--Please choose a file--</option></select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tile is-child box">
                        <h5>Community Detection</h5>
                        <div class="tile is-vertical is-parent">
                            <div class="control">
                                <div class="select">
                                    <select id="cd-select" class="is-small" disabled>
                                     <option value="">--Please choose a file--</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div><!-- END menu ancestor tile -->
            <div class="tile is-ancestor">
                <div class="tile is-vertical is-parent">
                    <div id="plot-metadata" class="tile"></div>
                    <div id="plot-controls" class="tile"></div>
                </div>
            </div>
            <div class="tile is-ancestor">
                <div class="tile box has-text-centered" style="overflow-x: auto;">
                    <div id="plot" style="width: 100%; margin: 0 auto;"></div>
                </div>
            </div> <!-- end top ancestor -->
        </div> <!-- Container-->
    </div>
    
    <div id="galaxy-config" href="${h.url_for('', qualified=True)}" history-id="${trans.security.encode_id( hda.history_id )}"></div>
    <script src="/static/plugins/visualizations/cloudforest/static/bundle.js"></script>
</body>


</html>