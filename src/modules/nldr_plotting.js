// Module for parsing and plotting NLDR coordinate data.
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import { htmlToElement, cleanExistingPlot, removeChildNodes } from './html_templates';

let coordinate_data = undefined;
let event_buld_fn = undefined;
let cd_groups = undefined; //If defined, use CD groups in plotting. Each group is a trace.

// Data coming from treescaper is often poorly formatted. Need to 
// do some cleaning here, mostly remove the artificats from having extra tabs in output.
const clean_data = function (data) {
    let cleaned = {};
    const rx = RegExp(/Dim_(\d)_/);
    Object.keys(data).forEach(k => {
        let m = rx.exec(k);
        let step1 = data[k].map(row => {
            return row.filter(f => f.length > 0).map(i => Number(i));
        });
        let step2 = step1.filter(row => { return row.length === Number(m[1]) });
        cleaned[k] = step2;
    });
    return cleaned;
}

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

const parallel_coordinates = function (file_contents) {
    document.getElementById("plot").append(htmlToElement(`<div id="dim-scatter-plot"/>`));
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

const construct_grouped_data = function (init_obj) {
    let r_val = [];
    let { data, dim } = init_obj;
    //default to 2d
    let misc_group = {
        x: [],
        y: [],
        name: `Single Member CD`,
        click_mode: 'select',
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 5
        },
        text: [],
        tree_num_offsets: [],
        showlegend: false,
        hovertemplate: "%{text}"
    };
    if (dim === 3) {
        misc_group.type = 'scatter3d';
        misc_group.z = [];
        misc_group.marker = {
            symbol: 'circle',
            size: 2
        };
    }
    Object.keys(cd_groups).forEach(grp_num => {
        if (cd_groups[grp_num].length > 1) {
            //Default to 2d
            let grp_trace = {
                x: [],
                y: [],
                name: `CD: ${grp_num}`,
                click_mode: 'select',
                mode: 'markers',
                type: 'scatter',
                marker: { size: 5 },
                text: [],
                tree_num_offsets: [],
                showlegend: false,
                hovertemplate: "%{text}"
            };
            if (dim === 3) {
                grp_trace.type = 'scatter3d';
                grp_trace.z = [];
                grp_trace.marker = {
                    symbol: 'circle',
                    size: 2
                };
            }
            cd_groups[grp_num].forEach(tree_num => {
                let row = data[tree_num - 1];
                grp_trace.x.push(Number(row[0]));
                grp_trace.y.push(Number(row[1]));
                if (dim === 3) {
                    grp_trace.z.push(Number(row[2]));
                }
                grp_trace.text.push(`Tree ${tree_num}`);
                grp_trace.tree_num_offsets.push(tree_num - 1);
            });
            r_val.push(grp_trace);
        } else {
            //These are 1 member groups. Aggregate into a 1 member group trace
            cd_groups[grp_num].forEach(tree_num => {
                let row = data[tree_num - 1];
                misc_group.x.push(Number(row[0]));
                misc_group.y.push(Number(row[1]));
                if (dim === 3) {
                    misc_group.z.push(Number(row[2]));
                }
                misc_group.text.push(`Tree ${tree_num}`);
                misc_group.tree_num_offsets.push(tree_num - 1);
            });
        }
    });
    r_val.push(misc_group);
    return r_val;
}

/**
 * file_contents is array of 3D coordinates. Array offset is tree number - 1.
 * 
 * @param {number[][]} file_contents 
 */
const scatter_2d = function (file_contents) {

    let axis_max_min = function (axis_data) {
        const max_mag = Math.ceil(Math.max(...axis_data.map(Math.abs)));
        let data_min = undefined;
        if (Math.min(...axis_data) < 0) {
            data_min = (-1) * max_mag;
        } else {
            data_min = Math.floor(Math.min(...axis_data));
        }
        return [data_min, max_mag];
    };

    let row_data = {
        x: [],
        y: [],
        text: []
    };
    file_contents.forEach((r, idx) => {
        row_data['x'].push(Number(r[0]));
        row_data['y'].push(Number(r[1]));
        row_data['text'].push(`Tree: ${idx + 1}`);
    });

    let data = [];
    if (cd_groups) {
        data = construct_grouped_data({
            data: file_contents,
            dim: 2,
            misc_group: {
                x: [],
                y: [],
                name: `No CD`,
                click_mode: 'select',
                mode: 'markers',
                type: 'scatter',
                marker: {
                    size: 5
                },
                text: [],
                tree_num_offsets: [],
                showlegend: false
            },
            trace_group: {
                x: [],
                y: [],
                name: undefined,
                click_mode: 'select',
                mode: 'markers',
                type: 'scatter',
                marker: {
                    size: 5
                },
                text: [],
                tree_num_offsets: [],
                showlegend: false
            }
        });
    } else {
        data.push({
            x: row_data['x'],
            y: row_data['y'],
            text: row_data['text'],
            click_mode: 'select',
            mode: 'markers',
            type: 'scatter',
            marker: { size: 5 },
            hovertemplate: "%{text}<extra></extra>",
        });
    }

    const layout = {
        xaxis: {
            range: axis_max_min(row_data['x']),
            zeroline: false,
        },
        yaxis: {
            range: axis_max_min(row_data['y']),
            zeroline: false
        },
    };

    const config = { responsive: true, displaylogo: false, scrollZoom: true }
    const s_plot = document.getElementById("dim-scatter-plot");
    Plotly2D.newPlot("dim-scatter-plot", data, layout, config);

    s_plot.on("plotly_click", function (data) {
        let tree_idx = data.points[0]['pointNumber'];
        if (data.points.length > 1) {
            console.log(`There are ${data.points.length} trees within this one data point marker.`)
        }
        console.log(`Draw ${data.points[0].text}`);
        dispatchEvent(
            event_buld_fn("TreeRequest",
                { guid: "", tree_number: tree_idx }
            ));
    });
}

const scatter_3d = function (file_contents) {

    const three_d_dom = "dim-scatter-plot";
    let row_data = {
        'x': [],
        'y': [],
        'z': [],
        'text': []
    };
    file_contents.forEach((r, idx) => {
        row_data['x'].push(Number(r[0]));
        row_data['y'].push(Number(r[1]));
        row_data['z'].push(Number(r[2]));
        row_data.text.push(`Tree: ${idx + 1}`);
    });
    let data = [];
    if (cd_groups) {
        data = construct_grouped_data({
            data: file_contents,
            dim: 3
        });
    } else {
        data = [{
            x: row_data['x'],
            y: row_data['y'],
            z: row_data['z'],
            text: row_data.text,
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                symbol: 'circle',
                color: row_data['z'],
                size: 2
            },
            hovertemplate: "%{text}<extra></extra>",
        },];
    }
    const layout = {
        autosize: true,
        height: 800,
        scene: {
            aspectratio: {
                x: 1.25,
                y: 1.25,
                z: 1.25
            },
            xaxis: {
                type: 'linear',
                zeroline: false
            },
            yaxis: {
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
            event_buld_fn("TreeRequest",
                { guid: "", tree_number: tree_idx }
            ));
    });
}

const build_2d_3d = function (contents) {
    document.getElementById("plot").append(htmlToElement(`
    <div id="scatter_dimensions" class="tabs is-centered is-small is-toggle">
    <ul>
      <li>
        <a id="2d" value="2d">2-D</a>
      </li>
      <li class="is-active">
        <a id="3d" value="3d">3-D</a>
      </li>
    </ul>
  </div>
  `));
    document.getElementById("plot").append(htmlToElement(`<div id="dim-scatter-plot"/>`));
    document.getElementById("scatter_dimensions").querySelectorAll('a').forEach(n => {
        n.addEventListener('click', e => {
            document.getElementById("scatter_dimensions").querySelectorAll('li').forEach(n => { n.classList = '' });
            document.getElementById(e.target.getAttribute('value')).parentElement.classList = 'is-active';

            document.getElementById('dim-scatter-plot').remove();
            document.getElementById("plot").append(htmlToElement(`<div id="dim-scatter-plot"/>`))

            if (e.target.getAttribute('value') === '3d') {
                scatter_3d(contents);
            } else {
                scatter_2d(contents);
            }
        });
    });

    scatter_3d(contents);
}

const build_2d = function (contents) {
    document.getElementById("plot").append(htmlToElement(`<div id="dim-scatter-plot"/>`));
    scatter_2d(contents);
}

const build_multidimension = function (contents) {
    parallel_coordinates(contents);
}

const plot_dimensions = function (dims, contents) {
    cleanExistingPlot();
    if (dims === 2) {
        build_2d(contents);
    }
    if (dims === 3) {
        build_2d_3d(contents);
    }
    if (dims > 3) {
        build_multidimension(contents);
    }
}

const nldr_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    //User has requested that CD groups be used in plotting.
    addEventListener("UseCDGroupsTrue", e => {
        cd_groups = e.detail.groups;
    });
    //User has requested that CD groups _not_ be used in plotting.
    addEventListener("UseCDGroupsFalse", e => {
        cd_groups = undefined;
    });

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            coordinate_data = clean_data(e.detail.contents);
            let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;
            plot_dimensions(plot_dimension, coordinate_data[Object.keys(coordinate_data)[0]]);
        }
    });

    addEventListener("NLDRPlotRequest", e => {
        dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
    });
}

export { nldr_plot_init };