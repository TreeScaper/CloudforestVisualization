import Plotly from 'plotly.js-basic-dist';
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import { htmlToElement, cleanExistingPlot, removeChildNodes } from "./html_templates";
import { build_event } from "./support_funcs";
import {
    nldr_clean_data,
    plot_dimensions,
    assign_colors,
    color_list,
    subtree_by_index,
    build_2d,
    build_3d,
    parse_subset_string,
    create_scatter_3d_data,
    create_scatter_2d_data
} from './nldr_plotting_core.js';

let plateau_file = undefined;
let cd_results_file = undefined;
let cd_with_coordinates_file = undefined; //TODO: Unclear what this coordinate file can be used for. This is an open question to Zhifeng. Grabbing and holding the file for future use.
let nldr_coordinate_file = undefined;
let grouping_message = undefined;

/*
 * Creates NLDR Plot.
 */
const plot_nldr = function (cd_groups) {

    // Create an array where each element is a group, and contains the member trees.
    let trees_by_groups = Object.values(cd_groups).reduce((a,b) => (a[b]=[], a), {});
    Object.keys(cd_groups).forEach(k => {
        trees_by_groups[cd_groups[k]].push(Number(k) + 1); //These are offset indexes. Change to tree number 1...n
    });

    let str = '';
    let c = assign_colors({"colors": color_list, "default_color": 'lightblue'})
    let current_color = c.assign_color();

    // Sort descending by number of trees in group.
    let sorted_keys = Object.keys(trees_by_groups).sort((a,b) => {return trees_by_groups[b].length - trees_by_groups[a].length});

    // Create color formatting string. Each group is mapped to a color, and each mapping is separated by a semicolon in string representing the format.
    sorted_keys.forEach(grp_num => {
        str += `[${trees_by_groups[grp_num].join()}: ${current_color}];`;
        current_color = c.assign_color();
    });

    // Remove last semicolon
    str = str.slice(0,-1);

    let subtree_by_index_string = str;

    // Clean NLDR coordinate data
    let coordinate_data = nldr_clean_data([nldr_coordinate_file]);

    // Determine dimension of coordinates. Each item in the coordinates a tree with n coordinates.
    let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;

    // The actual coordinates from the coordinate_data object.
    let d = coordinate_data[Object.keys(coordinate_data)[0]];

    // Generate object representing color-coding of coordinates.
    let colors = parse_subset_string(subtree_by_index_string, d.length)

    // Plot data.
    // WAGNERR: We should update instead of creating a new plot. Currently it just
    // overwrites the old.
    if (!document.getElementById("dim-scatter-plot")) {
        if (plot_dimension === 2) {
            build_2d(d, colors, false);
        }
        if (plot_dimension === 3) {
            build_3d(d, colors, false);
        }
    } else {
        if (plot_dimension === 2) {
            let new_marker = create_scatter_2d_data(d, colors)[0]['marker'];
            let update = {
                marker: new_marker
            };
            Plotly2D.restyle('dim-scatter-plot', update);
        }
        if (plot_dimension === 3) {
            let new_marker = create_scatter_3d_data(d, colors)[0]['marker'];
            let update = {
                marker: new_marker
            };
            Plotly3D.restyle('dim-scatter-plot', update);

            //let data = create_scatter_3d_data(d, colors);
            //data['marker.color'] ='red';
            //console.log(data)
            //console.log(data[0]);
            //Plotly3D.update('dim-scatter-plot', data[0]);
        }
    }
}

/*
 * Creates both community detection lambda and NLDR plots.
 */
const draw_graph = function (cd_data, nldr_data) {

    // Create traces for plotting label_community, num_communities, and modularity
    // against lambda.
    const line_width = 2;
    let trace1 = {
        x: cd_data["lambda"],
        y: cd_data["label_community"],
        type: "lines+markers",
        name: "Labels for Communities",
        line: { width: line_width, color: "red" },
        hovertemplate: "<b>Community Labels: </b>%{y}<extra></extra>"
    }
    let trace2 = {
        x: cd_data["lambda"],
        y: cd_data["num_communities"],
        type: "lines+markers",
        name: "Number of Communities",
        yaxis: "y3",
        line: { width: line_width, color: "green" },
        hovertemplate: "<b>Num. Communities: </b>%{y}<extra></extra>"
    }
    let trace3 = {
        x: cd_data["lambda"],
        y: cd_data["modularity"],
        type: "lines+markers",
        name: "Modularity",
        yaxis: "y2",
        line: { width: line_width, color: "blue" },
        hovertemplate: "<b>Modularity: </b>%{y:.3f}<extra></extra>"
    }

    let trace_data = [trace1, trace2, trace3];

    // Object with values for each of the four variables.
    let data_points = [...Array(cd_data['lambda'].length).keys()].map( function(i) {
        return {
            'lambda': cd_data['lambda'][i],
            'label_community': cd_data['label_community'][i],
            'num_communities': cd_data['num_communities'][i],
            'modularity': cd_data['modularity'][i],
        };
    });

    // Create an object for each step of the lambda-value slider, with a method
    // for updating the layout. This is passed to d3.
    let slider_steps = data_points.map(function(d) {
        return {
            label: d['lambda'],
            execute: true,
            method: 'relayout',
            args: [{
                'shapes' : [{
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper',
                    x0: d['lambda'] - 0.005,
                    y0: 0,
                    x1: d['lambda'] + 0.005,
                    y1: 1,
                    fillcolor: 'black',
                    opacity: 1,
                    line: {
                        width: 0
                    }
                }]
            }]
        };
    });

    // Create layout for cd lambda plot.
    let layout = {
        title: 'Community Detection',
        showlegend: false,
        margin: {
            r: 10
        },
        xaxis: {
            title: "Lambda", zeroline: false,
        },
        yaxis: { title: '', zeroline: false, color: "red" },
        yaxis2: {
            overlaying: 'y',
            side: 'right',
            color: "blue",
            showgrid: false,
            zeroline: false,
        },
        yaxis3: {
            overlaying: 'y',
            position: 0.03,
            color: "green",
            side: 'left',
            anchor: "free",
            showgrid: false,
            zeroline: false,
        },

        // This slider adjusts lambda and updates the layout as it changes.
        sliders:
        [{
            pad: {t: 30},
            currentvalue: {
                xanchor: 'right',
                prefix: '\u03BB: ',
                font: {
                    color: 'black',
                    size: 10
                }
            },
            steps: slider_steps,
        }],
    };

    let config = { responsive: true, displaylogo: false, scrollZoom: true };

    // Add div for plot.
    document.getElementById("inline-plot").append(htmlToElement(`<div id="quality_graph";style="float:left;vertical-align:top;display:inline-block;"></div>`));

    // Plot NLDR visualization.
    plot_nldr(cd_data["community_maps"][0]);

    // Plot community detection trace data.
    Plotly.newPlot("quality_graph", trace_data, layout, config);

    // Update NLDR to group trees by colors according to communities corresponding to current
    // slider lambda value.
    var cd_plot = document.getElementById('quality_graph')
    cd_plot.on('plotly_sliderchange', function(sliderValue){

        // WAGNERR: This code may be useful for improving performance.
        //lambda_index = cd_data['lambda'].find_index(l => l == sliderValue.slider.active);
        //document.getElementById('dim-scatter-plot').remove();

        // Get lambda value.
        let lambda_index = sliderValue.slider.active;

        // Replot NLDR data with new communities.
        plot_nldr(cd_data["community_maps"][lambda_index]);
    });
}


/*
 * Parses community detection results from TreeScaper output.
 */
const parse_results = function (data) {
    let plot_data = {};
    plot_data["label_community"] = data[1].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["lambda"] = data[3].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["num_communities"] = data[5].splice(1).map(v => Number(v.trim()));
    plot_data["modularity"] = data[7].splice(1).map(v => Number(v.trim()));
    //console.log(data.slice(9));
    plot_data["community_maps"] = [...Array(plot_data["lambda"].length - 1).keys()].map( function(i) {
        //console.log(i);
        //console.log(data.slice(9).map(r => r[i + 1]))
        return data.slice(9).map(r => r[i + 1]);
    });

    return plot_data;
}

//REFACTOR THIS TO MODULE
/*
 * Parses community detection data, separating by newline & tab
 */
const cd_clean_data = function(data) {
    let t_arr = data.split('\n');
    let arr = []
    t_arr.forEach(d => {
        if (d.length > 0) {
            arr.push(d.split('\t')); 
        }
    });
    return arr;
}

/**
 *  CD plateaus can be computed for bipartitions or trees. 
 *  
 *  Here we parse a JSON object of data into on ordered JSON object
 *  containing communitues per tree/bipartition for each range of calculation bounds
 * 
 * @param {*} raw_data CD plateau results in JSON format 
 */
const parse_plateau_data = function(raw_data) {
    let data = raw_data.data;
    let header = raw_data.header;
    let file_name = raw_data.fileName;
    let ret_val = {};
    ret_val.file_name = file_name;
    ret_val.node_type = header.node_type;
    ret_val.cd_bounds = [];

    let data_lines = data.split('\n').filter(v => v.length > 0);
    data_lines.forEach((l, i) => {
        let values = l.split('\t').filter(v => v.length > 0);
        if (i === 0) {
            values.slice(1).forEach(e => {
                ret_val.cd_bounds.push({
                    'cd_by_node': {}
                });
            });
        }
        if (i === 6) {
            //noop
        }
        if (i < 6) {
            values.slice(1).forEach((v,idx) => {
                ret_val.cd_bounds[idx][values[0]] = Number(v);
            });
        }
        if (i > 6) {
            values.slice(1).forEach((v, idx) => {
                ret_val.cd_bounds[idx].cd_by_node[values[0]] = v;
            });
        }
        
    });
    return ret_val;
}

/**
 * Nodes into groups, then run basic stats on the grouping.
 * Add this as properties directly to the p_obj.
 * @param {*} p_obj 
 */
const plateau_stats = function (p_obj) {
    p_obj.cd_bounds.forEach(b => {
        b.group_keys = {};
        Object.values(b.cd_by_node).forEach(v => {
          b.group_keys[v] = [];
        }); 
        Object.keys(b.cd_by_node).forEach(k => {
          b.group_keys[b.cd_by_node[k]].push(k);
        });
        let arr = [];
        Object.keys(b.group_keys).forEach(k => {
            arr.push(b.group_keys[k].length);
        });
        b.avg_nodes_per_group = arr.reduce((a, b) => (a + b)) / arr.length;
        b.number_of_groups = arr.length;
    });
}

/*
 * Clears grouping information and NLDR plotting from the "Use in Plotting" option.
 */
const wire_cd_clear = function() {
    document.getElementById('btn-clear-cd').addEventListener('click', () => {
        removeChildNodes('group-msg');
        grouping_message = undefined;
        dispatchEvent(build_event('RemoveCDPlotting', {}));
    });
}

/*
 * Creates HTML to display community detection grouping information
 */
const draw_grouping_message = function(msg) {
    let e = document.getElementById('group-msg');
    removeChildNodes('group-msg');
    e.append(htmlToElement(msg));
    e.append(htmlToElement(`<button id="btn-clear-cd" class="button is-warning is-small">Clear</button>`));
    grouping_message = msg;
    wire_cd_clear();
}

/*
 * Creates HTML to display community detection plataeu information
 */
const present_plateaus = function(p_obj) {
    cleanExistingPlot();
    let s = `<div class="tile is-ancestor">
        <div class="tile is-parent is-vertical">
            <div class="tile is-child">
                <h3>CD Grouping for ${p_obj.node_type}s by Plateau Bounds</h3>
                <div id="group-msg" class="has-text-success"></div>
            </div>`;
    
    p_obj.cd_bounds.forEach((bound, idx) => {
        s += `<div class="tile is-child box">
        <div class="columns">
        <div class="column is-one-fifth"><button value="${idx}" class="button is-light grouping-command">Use in Plotting</button></div>
        <div class="column">
        <p>Start LB: ${bound["startLB:"]} End LB: ${bound["endLB:"]}</p>
        <p>Start UB: ${bound["startUB:"]} End UB: ${bound["endUB:"]}</p>
        <p>Number of Groups: ${bound.number_of_groups}</p>
        <p>Avg nodes per Group: ${bound.avg_nodes_per_group.toFixed(4)}</p>
        </div>
        </div>
        </div>`;
    });
    s += `</div></div>`;
    document.getElementById("plot").append(htmlToElement(s));

    //Are we already sitting on a grouping
    if (grouping_message) {
        draw_grouping_message(grouping_message);
    }

    //Wire the buttons
    document.querySelectorAll('.grouping-command').forEach(n => {
        n.addEventListener('click', evt => {

            let offset = evt.target.getAttribute('value');
            let msg = `<p>Using the ${p_obj.cd_bounds[offset].number_of_groups} groups in bound ${Number(offset) + 1} for plotting.</p>`;
            draw_grouping_message(msg);
            
            let node_type = p_obj.node_type;
            let cd_grouping = p_obj.cd_bounds[offset].cd_by_node;
            let evt_title = `CDBy${node_type}`; //CDByTree or CDByBipartition
            dispatchEvent(build_event(evt_title, {groups: cd_grouping}));
            wire_cd_clear();
        });
    });

} 

/*
 * Top-level function to plot plataeu data, lambda data, and NDLR points.
 */
const plot_community_detection = function() {
    //Step 1: Prepare plateau data for presentaiton
    //  - Stats of grouping: Number of groups, avg nodes per group, SD nodes per group.
    if (plateau_file.data !== "") {
        let parsed_data = parse_plateau_data(plateau_file);
        plateau_stats(parsed_data);
        present_plateaus(parsed_data);
    }

    if (!document.getElementById("inline-plot")) {
        document.getElementById("plot").append(htmlToElement('<div id="inline-plot" style="display: flex; width: 100%; margin: 0 auto, font-size:0;"/>'));
    }
    
    //Step 2: Prepare the lambda/modularity data
    let lambda_data = parse_results(cd_clean_data(cd_results_file.data));
    draw_graph(lambda_data);
}


/*
 * Initializes events for community detection plotting.
 */
const community_detection_init = function (init_obj) {
    let { guid_fn } = init_obj;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {

            e.detail.contents.forEach(entry => {
                if (RegExp(/CD Plateaus/i).test(entry.fileName)) {
                    plateau_file = entry;
                }
                if (RegExp(/CD with NLDR Coordinates/i).test(entry.fileName)) {
                    cd_with_coordinates_file = entry;
                }
                if (RegExp(/CD Results/i).test(entry.fileName)) {
                    cd_results_file = entry;
                }
                if (RegExp(/NLDR Coordinates/i).test(entry.fileName)) {
                    nldr_coordinate_file = entry;
                }
            });
            plot_community_detection();
        }
    });

    addEventListener("CDFiles", e => {      
        if (plateau_file) {
            plot_community_detection();
        } else {    
            let plateau_file_obj = e.detail.files.filter(obj => RegExp(/CD Plateaus/i).test(obj.name));
            let cd_results_file_obj = e.detail.files.filter(obj => RegExp(/CD Results/i).test(obj.name));
            let nldr_coordinate_file_obj = e.detail.files.filter(obj => RegExp(/NLDR Coordinates/i).test(obj.name));
            
            dispatchEvent(build_event("FileContentsRequest", {
                guid: my_guid,
                // Grab the latest of each filetype
                files: [plateau_file_obj.pop().dataset_id, cd_results_file_obj.pop().dataset_id, nldr_coordinate_file_obj.pop().dataset_id]
            }));
        }
    });

    addEventListener("CDPlotRequest", e => {
        console.log("CDPlot EVENT");
        dispatchEvent(build_event("CDFilesRequest", {guid: my_guid}));
    });
}

export { community_detection_init }
