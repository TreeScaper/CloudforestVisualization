// Module for parsing and plotting NLDR coordinate data.
import Plotly from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import { htmlToElement, cleanExistingPlot, removeChildNodes } from './html_templates';

let coordinate_data = undefined;
let event_buld_fn = undefined;

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

const scatter_2d = function (file_contents) {
    removeChildNodes('dim-scatter-plot');
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
        y: []
    };
    file_contents.forEach(r => {
        row_data['x'].push(Number(r[0]));
        row_data['y'].push(Number(r[1]));
    });
    const trace1 = {
        x: row_data['x'],
        y: row_data['y'],
        click_mode: 'select',
        mode: 'markers',
        type: 'scatter',
        marker: { size: 5 }
    };
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

    Plotly.newPlot("dim-scatter-plot", [trace1], layout, config);
}

const scatter_3d = function (file_contents) {
    const three_d_dom = "dim-scatter-plot";
    let row_data = {
        'x': [],
        'y': [],
        'z': []
    };
    file_contents.forEach(r => {
        row_data['x'].push(Number(r[0]));
        row_data['y'].push(Number(r[1]));
        row_data['z'].push(Number(r[2]));
    });
    const data = [{
        x: row_data['x'],
        y: row_data['y'],
        z: row_data['z'],
        mode: 'markers',
        type: 'scatter3d',
        marker: {
            symbol: 'circle',
            color: row_data['z'],
            size: 2
        },
        hovertemplate: "Data Point: %{pointNumber} <br> Coordinates: x: %{x} y: %{y} z: %{z}",

    },];
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
                icon: Plotly.Icons.pencil,
                click: function () {
                    Plotly3D.restyle(three_d_dom, 'marker.color', ['black']);
                }
            },
            {
                name: 'Point color Z-axis',
                icon: Plotly.Icons.pencil,
                click: function () {
                    Plotly3D.restyle(three_d_dom, 'marker.color', [row_data['z']]);
                }
            },
            {
                name: 'Point color Y-axis',
                icon: Plotly.Icons.pencil,
                click: function () {
                    Plotly3D.restyle(three_d_dom, 'marker.color', [row_data['y']]);
                }
            },
            {
                name: 'Point color X-axis',
                icon: Plotly.Icons.pencil,
                click: function () {
                    Plotly3D.restyle(three_d_dom, 'marker.color', [row_data['x']]);
                }
            },
            {
                name: 'Enlarge Points',
                icon: Plotly.Icons.pencil,
                click: function (data) {
                    let curr_size = data.data[0].marker.size
                    Plotly3D.restyle(three_d_dom, 'marker.size', curr_size += 2);
                }
            },
            {
                name: 'Shrink Points',
                icon: Plotly.Icons.pencil,
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
        let tree_idx = data.points[0]['pointNumber'] - 1;
        console.log(`Draw tree for ${tree_idx}`);
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