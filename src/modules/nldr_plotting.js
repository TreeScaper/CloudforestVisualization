// Module for parsing and plotting NLDR coordinate data.
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import {
    htmlToElement,
    cleanExistingPlot,
    removeChildNodes
} from './html_templates';

let coordinate_data = undefined;
let event_buld_fn = undefined;
let cd_groups = new Map();
const group_colors = [
    "#0074D9", "#7FDBFF", "#39CCCC", "#3D9970", "#2ECC40",
    "#01FF70", "#FFDC00", "#FF851B", "#FF4136", "#85144b", "#F012BE", "#B10DC9"
]; //12 colors, beyond that use "#AAAAAA" gray

// Data coming from treescaper is often poorly formatted. Need to 
// do some cleaning here, mostly remove the artificats from having extra tabs in output.
const clean_data = function (data) {
    let cleaned = {};
    let obj = data[0];
    let key_name = obj.fileName + " : " + obj.header.dimension;
    let t_arr = obj.data.split('\n'); //string to array or rows. Rows are still strings.
    let arr = [];
    t_arr.forEach(d => {
        arr.push(d.split('\t')) //each array element to array of values.
    });
    let step1 = arr.map(row => {
        return row.filter(f => f.length > 0).map(i => Number(i)); //string to number
    });
    let step2 = step1.filter(r => r.length === Number(obj.header.dimension));
    cleaned[key_name] = step2;
    
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

    data.push({
        x: row_data['x'],
        y: row_data['y'],
        text: row_data['text'],
        click_mode: 'select',
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 5
        },
        hovertemplate: "%{text}<extra></extra>",
    });


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

    const config = {
        responsive: true,
        displaylogo: false,
        scrollZoom: true
    }
    const s_plot = document.getElementById("dim-scatter-plot");
    Plotly2D.newPlot("dim-scatter-plot", data, layout, config);

    s_plot.on("plotly_click", function (data) {
        let tree_idx = data.points[0]['pointNumber'];
        if (data.points.length > 1) {
            console.log(`There are ${data.points.length} trees within this one data point marker.`)
        }
        console.log(`Draw ${data.points[0].text}`);
        dispatchEvent(
            event_buld_fn("TreeRequest", {
                guid: "",
                tree_number: tree_idx
            }));
    });
}

const scatter_3d = function (file_contents) {
    const three_d_dom = "dim-scatter-plot";
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
        if (cd_groups.get(idx + 1)) {
            row_data.color.push(cd_groups.get(idx + 1).group_color);
            console.log(`Grouped point coordinates x:${r[0]} y:${r[1]} z:${r[2]}`);
        } else {
            row_data.color.push("#DDDDDD");
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
            event_buld_fn("TreeRequest", {
                guid: "",
                tree_number: tree_idx
            }));
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
            document.getElementById("scatter_dimensions").querySelectorAll('li').forEach(n => {
                n.classList = ''
            });
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

const generate_tree_by_group = function (groups) {
    let r_val = new Map();
    groups.forEach((g, idx) => {
        let grp_num = Number(g[0]);
        g[1].forEach(t_num => {
            let o = {};
            if (idx <= group_colors.length) {
                o = {
                    group_number: grp_num,
                    group_color: group_colors[idx]
                }
            } else {
                o = {
                    group_number: grp_num,
                    group_color: "#AAAAAA"
                }
            }
            r_val.set(t_num, o);
        })
    });
    return r_val;
}

const nldr_plot_init = function (init_obj) {
    let {
        guid_fn,
        event_fn
    } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    //User has requested that CD groups be used in plotting.
    addEventListener("UseCDGroupsTrue", e => {
        if (e.detail.type === "Trees") {
            cd_groups = generate_tree_by_group(e.detail.groups);
        }
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
        dispatchEvent(event_buld_fn("FileContentsRequest", {
            guid: my_guid,
            files: [e.detail.file_id]
        }));
    });
}

export {
    nldr_plot_init
};