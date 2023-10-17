// Module for parsing and plotting NLDR coordinate data.
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import {
    htmlToElement,
    cleanExistingPlot
} from '../utilities/html_templates';
import { parse_tsv, build_event } from "../utilities/support_funcs";

//From plotly python alphabet color sequence
let color_list = ["#AA0DFE", "#3283FE", "#85660D", "#782AB6", "#565656", "#1C8356", "#16FF32",
                    "#F7E1A0", "#E2E2E2", "#1CBE4F", "#C4451C", "#DEA0FD", "#FE00FA", "#325A9B",
                    "#FEAF16", "#F8A19F", "#90AD1C", "#F6222E", "#1CFFCE", "#2ED9FF", "#B10DA1",
                    "#C075A6", "#FC1CBF", "#B00068", "#FBE426", "#FA0087"];

let fall_back_color = "black";
/**
 * Object for generating colors for plotting
 */
const assign_colors = function(spec) {
    let {colors, default_color} = spec;
    let count = 0;
    let assign_color = function() {
        if (count < colors.length) {
            let rval = colors[count];
            count++;
            return rval;
        } else {
            return default_color;
        }
    }
    return Object.freeze({
        assign_color
    });

}

// Data coming from treescaper is often poorly formatted. Need to
// do some cleaning here, mostly remove the artificats from having extra tabs in output.
const nldr_clean_data = function (data) {
    let cleaned = {};
    let obj = data[0];
    let key_name = obj.fileName + " : " + obj.header.dimension;
    let arr = parse_tsv(obj.data);

    let step1 = arr.map(row => {
        return row.filter(f => f.length > 0).map(i => Number(i)); //string to number
    });
    let step2 = step1.filter(r => r.length === Number(obj.header.dimension));
    cleaned[key_name] = step2;

    return cleaned;
}

/*
 * Divides rows of coordinates into coordinates grouped by dimension.
 */
const rows_to_dimensions = function (row_data) {
    let dimension_data = {};
    row_data.forEach(row => {
        row.forEach((item, idx) => {
            let dim_name = `Dimension_${idx}`;
            if (Object.keys(dimension_data).indexOf(dim_name) === -1) {
                dimension_data[dim_name] = [];
            }
            dimension_data[dim_name].push(item);
        });
    });
    return dimension_data;
}

/*
 * Creates a visualization sufficient for dimensions greater than 3 by plotting coordinates values against their dimension.
 */
const parallel_coordinates = function (file_contents) {
    if (!document.getElementById("dim-scatter-plot")) {
        document.getElementById("plot").append(htmlToElement(`<div id="dim-scatter-plot" style="float:center;vertical-align:top;display:inline-block;"/>`));
    }
    let dims = [];
    let dim_data = rows_to_dimensions(file_contents);
    Object.keys(dim_data).forEach(k => {
        dims.push({
            range: [Math.min(...dim_data[k]), Math.max(...dim_data[k])],
            label: k,
            values: dim_data[k]
        })
    });
    let data = [{
        type: "parcoords",
        line: {
            showscale: false,
            colorscale: 'Jet',
            color: dim_data[Object.keys(dim_data)[0]]
        },
        dimensions: dims,
    }];
    let layout = {
        height: 800,
        width: 1200
    }
    PlotlyParallel.newPlot('dim-scatter-plot', data, layout, {
        displaylogo: false,
    });
}

/*
 * Reads NLDR file output and prepares data for plotting.
 */
const create_scatter_2d_data = function (file_contents, in_color) {

    let row_data = {
        x: [],
        y: [],
        text: [],
        color: []
    };
    file_contents.forEach((r, idx) => {
        row_data['x'].push(Number(r[0]));
        row_data['y'].push(Number(r[1]));
        row_data['text'].push(`Tree: ${idx + 1}`);
        if (in_color.length > 1) {
            row_data.color.push(in_color[idx]);
        } else {
            row_data.color.push(in_color[0]);
        }
    });

    let data = [];

    data.push({
        x: row_data['x'],
        y: row_data['y'],
        text: row_data['text'],
        click_mode: 'select',
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 8,
            color: row_data.color
        },
        hovertemplate: "%{text}<extra></extra>",
    });

    return data;
};

/**
 * file_contents is array of 3D coordinates. Array offset is tree number - 1.
 *
 * @param {number[][]} file_contents
 */
const scatter_2d = function (file_contents, in_color) {

    let data = create_scatter_2d_data(file_contents, in_color);

    const layout = {
        height: 600,
        margin: {
            l: 10
        },
        xaxis: {
            zeroline: false,
            scaleratio: 1
        },
        yaxis: {
            zeroline: false,
            scaleanchor: "x",
            scaleratio: 1
        },
    };

    const config = {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        modeBarButtonsToAdd: [
            [
                {
                    name: 'Enlarge points',
                    icon: Plotly2D.Icons.pencil,
                    click: function() {
                        let curr_size = data[0].marker.size;
                        Plotly2D.restyle("dim-scatter-plot", 'marker.size', curr_size += 2);
                    },
                },
                {
                    name: 'Shrink points',
                    icon: Plotly2D.Icons.pencil,
                    click: function() {
                        let curr_size = data[0].marker.size;
                        if (curr_size <= 4) {
                            console.log('NOP');
                        } else {
                            Plotly2D.restyle("dim-scatter-plot", 'marker.size', curr_size -= 2);
                        }
                    }
                }
            ]
        ]
    }
    const s_plot = document.getElementById("dim-scatter-plot");
    Plotly2D.newPlot("dim-scatter-plot", data, layout, config);

    s_plot.on("plotly_click", function (data) {
        let tree_idx = data.points[0]['pointNumber'];
        console.log(`Draw ${data.points[0].text}`);
        dispatchEvent(
            build_event("TreeRequest", {
                guid: "",
                tree_number: tree_idx
            }));
    });
};

/*
 * Reads NLDR file output and prepares data for plotting.
 */
const create_scatter_3d_data = function (file_contents, in_color) {
    let row_data = {
        'x': [],
        'y': [],
        'z': [],
        'text': [],
        'color': []
    };
    file_contents.forEach((r, idx) => {
        row_data['x'].push(Number(r[0]));
        row_data['y'].push(Number(r[1]));
        row_data['z'].push(Number(r[2]));
        row_data.text.push(`Tree: ${idx + 1}`);
        if (in_color.length > 1){
            row_data.color.push(in_color[idx]);
        } else {
            row_data.color.push(in_color[0]);
        }
    });
    let data = [];
    data = [{
        x: row_data['x'],
        y: row_data['y'],
        z: row_data['z'],
        text: row_data.text,
        mode: 'markers',
        type: 'scatter3d',
        marker: {
            symbol: 'circle',
            color: row_data.color,
            size: 2
        },
        hovertemplate: "%{text}<extra></extra>",
    }, ];
    return data;
};

/**
 * file_contents is array of 3D coordinates. Array offset is tree number - 1.
 *
 * @param {number[][]} file_contents
 */
const scatter_3d = function (file_contents, in_color) {
    const three_d_dom = "dim-scatter-plot";
    let data = create_scatter_3d_data(file_contents, in_color);
    const layout = {
        autosize: true,
        height: 600,
        // margin seems to be undocumented, but works.
        margin: {
            l: 10
        },
        scene: {
            aspectmode: "data",
            xaxis: {
                type: 'linear',
                zeroline: false
            },
            yaxis: {
                type: 'linear',
                zeroline: false
            },
            zaxis: {
                type: 'linear',
                zeroline: false
            }
        }
    };

    const btns = {
        displaylogo: false,
        modeBarButtonsToAdd: [
            [{
                    name: 'All points black',
                    icon: Plotly3D.Icons.pencil,
                    click: function () {
                        Plotly3D.restyle(three_d_dom, 'marker.color', ['black']);
                    }
                },
                {
                    name: 'Point color Z-axis',
                    icon: Plotly3D.Icons.pencil,
                    click: function () {
                        Plotly3D.restyle(three_d_dom, 'marker.color', [row_data['z']]);
                    }
                },
                {
                    name: 'Point color Y-axis',
                    icon: Plotly3D.Icons.pencil,
                    click: function () {
                        Plotly3D.restyle(three_d_dom, 'marker.color', [row_data['y']]);
                    }
                },
                {
                    name: 'Point color X-axis',
                    icon: Plotly3D.Icons.pencil,
                    click: function () {
                        Plotly3D.restyle(three_d_dom, 'marker.color', [row_data['x']]);
                    }
                },
                {
                    name: 'Enlarge Points',
                    icon: Plotly3D.Icons.pencil,
                    click: function (data) {
                        let curr_size = data.data[0].marker.size
                        Plotly3D.restyle(three_d_dom, 'marker.size', curr_size += 2);
                    }
                },
                {
                    name: 'Shrink Points',
                    icon: Plotly3D.Icons.pencil,
                    click: function (data) {
                        let curr_size = data.data[0].marker.size;
                        if (curr_size === 2) {
                            console.log('Nope, too small');
                        } else {
                            Plotly3D.restyle(three_d_dom, 'marker.size', curr_size -= 2);
                        }
                    }
                }
            ],
        ]
    }
    const s_plot = document.getElementById(three_d_dom);
    Plotly3D.newPlot(three_d_dom, data, layout, btns);
    s_plot.on("plotly_click", function (data) {
        let tree_idx = data.points[0]['pointNumber'];
        console.log(`Draw ${data.points[0].text}`);
        if (data.points.length > 1) {
            console.log(`There are ${data.points.length} trees within this one data point marker.`)
        }
        dispatchEvent(
            build_event("TreeRequest", {
                guid: "",
                tree_number: tree_idx
            }));
    });
}

/*
 * This color-codes scatter data where every nth point shares the same color.
 */
const plot_every_nth = function(cut_off, dimension, coordinate_data) {

    let c = assign_colors({"colors": color_list, "default_color": fall_back_color})
    let d = coordinate_data[Object.keys(coordinate_data)[0]];
    let new_colors = [];
    let current_color = undefined;
    d.forEach((v, idx) => {
        if (idx % cut_off === 0) {
            current_color = c.assign_color();
        }
        new_colors.push(current_color);
    });
    cleanExistingPlot();
    if (dimension === 2) {
        build_2d(d, new_colors);
    }
    if (dimension === 3) {
        build_3d(d, new_colors);
    }
}

/**
 * User wishes to subset the NLDR trees every nth number of trees.
 *
 * Draw gui, let user enter nth value, execute
 */
const subtree_every_nth = function(dimension, coordinate_data) {
    let s = `
    <div id="user-plot-ctrls" class="tile is-parent">
        <div class="tile is-child box>
            <label for="nth-value">Subset Trees every Nth Tree</label>
            <input id="nth-value" class="input" type="text" placeholder="10">
            <button id="execute-nth-value" class="button is-small">Execute</button>
        </div>
    </div>`;
    document.getElementById('subset-plots-div').append(htmlToElement(s));

    document.getElementById('execute-nth-value').addEventListener('click', e => {
        let el = document.getElementById("nth-value");
        if (el.value.length > 0) {
            plot_every_nth(Number(el.value), dimension, coordinate_data);
        }
    });
}

/**
 * Parse the user's subset string
 *
 *  (1-50: blue); (60-200: green); (300,301,302: yellow)
 *
 * into an array of colors by offset
 *
 *  ["blue","blue"...,"green","green"...,"yellow"...]
 *
 * @param {int} ar_length the lenght of the data set to plot
 * @param {string} s the user's subset string
 */
const parse_subset_string = function(s, ar_length) {
    let rval = [];
    rval.length = ar_length
    rval.fill("black"); //default color for data point

    let t = s.split(';').filter(v => v.length > 0).map(d => d.trim())
    t.forEach(entry => {
        let cln = entry.replace(/[\[|\]]/g, "");
        let t2 = cln.split(':'); //Array [ "1-50", " blue" ]
        if (t2[0].includes('-')) {
            //Ranges
            let offsets = t2[0].split('-');
            let start = Number(offsets[0]) - 1;
            let end = Number(offsets[1]);
            rval.fill(t2[1].trim(), start, end);
        } if (t2[0].includes(',')) {
            //Specific indexes
            let sp = t2[0].split(',');
            let sp_idx = sp.map(v => Number(v));
            sp_idx.forEach(v => {
                rval[v - 1] = t2[1].trim();
            });
        } if (Number(t2[0]) != NaN) {
            rval[t2[0] - 1] = t2[1].trim();
        } else {
            console.error(`Incorrect formatting of ${t2[0]}`);
        }

    });
    return rval;
}


/**
 * User wishes to subset the NLDR trees by sepcific indexes.
 *
 * Draw gui, let user enter indexes, execute
 */
const subtree_by_index = function(dimension, pattern_string, coordinate_data) {
    let s = `
    <div id="user-plot-ctrls" class="tile is-parent">
        <div class="tile is-child box>
            <label for="nth-value">Subset Trees by Index <p class="is-size-7">Group with brackets <strong>[]</strong> - Separate with semicolons <strong>;</strong></p></label>
            <input id="nth-value" class="input" type="text" placeholder="[1-50: blue];[60-200: green] ;[300,301,302: yellow]" size="40">
            <button id="execute-index-string" class="button is-small">Execute</button>
        </div>
    </div>`;

    document.getElementById('subset-plots-div').append(htmlToElement(s));
    if (pattern_string) {
        document.getElementById('nth-value').value = pattern_string;
    }
    document.getElementById('execute-index-string').addEventListener('click', e => {
        let el = document.getElementById("nth-value");
        if (el.value.length > 0) {
            let d = coordinate_data[Object.keys(coordinate_data)[0]];
            let colors = parse_subset_string(el.value, d.length)
            cleanExistingPlot();
            if (dimension === 2) {
                build_2d(d, colors);
            }
            if (dimension === 3) {
                build_3d(d, colors);
            }
        }
    });
}

/**
 * User wishes to load a text file for creating subsets of trees.
 */
const subtree_by_file = function (dimesion, coordinate_data) {
    let s = `
    <div id="user-plot-ctrls" class="tile is-parent">
        <div class="tile is-child box>
            <label for="subset-tree-file">Choose a text file to upload:</label>
            <input type="file" id="subset-tree-file" name="subset-tree-file" accept="text/plain">
        </div>
    </div>`;

    document.getElementById('subset-plots-div').append(htmlToElement(s));
    document.getElementById('subset-tree-file').addEventListener('change', e => {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function() {
            console.log(reader.result);
            let d = coordinate_data[Object.keys(coordinate_data)[0]];
            let colors = parse_subset_string(reader.result, d.length)
            cleanExistingPlot();
            if (dimesion === 2) {
                build_2d(d, colors);
            }
            if (dimesion === 3) {
                build_3d(d, colors);
            }
        }
        reader.onerror = function() {
            console.error(reader.error);
        }
    });

}

/*
 * Remove plot controls HTML.
 */
const clean_it = function() {
    try{
        document.getElementById('user-plot-ctrls').remove();
    } catch (error) {
    }
}

/*
 * Builds 3D plotting menu, creates plot element, and scatter plots data.
 */
const build_3d = function (contents, in_colors=["blue"], build_menu=true) {
    if (!document.getElementById("dim-scatter-plot")) {
        let plot_div = "plot";
        if (document.getElementById("inline-plot")) {
            plot_div = "inline-plot";
        }
        document.getElementById(plot_div).append(htmlToElement(`<div id="dim-scatter-plot" style="float:center;vertical-align:top;"/>`));
    }
    scatter_3d(contents, in_colors);
}

/*
 * Builds 2D plotting menu, creates plot element, and scatter plots data.
 */
const build_2d = function (contents, in_colors=["blue"], build_menu=true) {
    if (!document.getElementById("dim-scatter-plot")) {
        let plot_div = "plot";
        if (document.getElementById("inline-plot")) {
            plot_div = "inline-plot";
        }
        document.getElementById(plot_div).append(htmlToElement(`<div id="dim-scatter-plot" style="float:center;vertical-align:top;"/>`));
    }
    scatter_2d(contents, in_colors);
}

/*
 * Call appropriate plotting function based on dimension.
 */
const plot_dimensions = function (dims, contents) {
    if (dims === 2) {
        build_2d(contents);
    }
    if (dims === 3) {
        build_3d(contents);
    }
    if (dims > 3) {
        parallel_coordinates(contents);
    }
}

export {
    nldr_clean_data,
    plot_dimensions,
    assign_colors,
    color_list,
    subtree_by_index,
    subtree_by_file,
    subtree_every_nth,
    build_2d,
    build_3d,
    parse_subset_string,
    create_scatter_3d_data,
    create_scatter_2d_data,
    clean_it
};

