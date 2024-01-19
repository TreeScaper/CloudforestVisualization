// Module for parsing and plotting NLDR coordinate data.
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import {
    htmlToElement,
    cleanExistingPlot
} from '../utilities/html_templates';
import { parse_tsv, build_event } from "../utilities/support_funcs";
import * as constants from "../utilities/constants";

//From plotly python alphabet color sequence
let color_list = ["#AA0DFE", "#3283FE", "#85660D", "#782AB6", "#565656", "#1C8356", "#16FF32",
                    "#F7E1A0", "#E2E2E2", "#1CBE4F", "#C4451C", "#DEA0FD", "#FE00FA", "#325A9B",
                    "#FEAF16", "#F8A19F", "#90AD1C", "#F6222E", "#1CFFCE", "#2ED9FF", "#B10DA1",
                    "#C075A6", "#FC1CBF", "#B00068", "#FBE426", "#FA0087"];

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
const nldr_clean_data = function (obj) {
    let cleaned = {};
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
        let scatter_plot_div = document.createElement('div');
        scatter_plot_div.setAttribute('id', constants.scatter_plot_id);
        document.getElementById("plot").append(scatter_plot_div);
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
const scatter_2d = function (file_contents, in_color, click_function) {

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

    s_plot.on("plotly_click", click_function);
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

    s_plot.on("plotly_click", click_function);
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
 * Call appropriate plotting function based on dimension.
 */
const plot_dimensions = function (dims, contents, colors, click_function=null) {
    if (dims > 3) {
        parallel_coordinates(contents);
    } else {
        if (!document.getElementById("dim-scatter-plot")) {
            let plot_div = "plot";
            if (document.getElementById("inline-plot")) {
                plot_div = "inline-plot";
            }
            document.getElementById(plot_div).append(htmlToElement(`<div id="dim-scatter-plot" style="float:center;vertical-align:top;"/>`));
        }
        if (dims === 2) {
            scatter_2d(contents, colors, click_function);
        }
        if (dims === 3) {
            scatter_3d(contents, colors, click_function);
        }
    }
}

export {
    nldr_clean_data,
    plot_dimensions,
    assign_colors,
    color_list,
    parse_subset_string,
    create_scatter_3d_data,
    create_scatter_2d_data,
    clean_it
};

