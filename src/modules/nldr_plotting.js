// Module for parsing and plotting NLDR coordinate data.
import Plotly from 'plotly.js-basic-dist';
import { htmlToElement, removeChildNodes } from './html_templates';

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

}

const plot_dimensions = function (dims, contents) {
    removeChildNodes('plot');
    document.getElementById("plot").append(htmlToElement(`
    <div id="scatter_dimensions" class="tabs is-centered is-small is-toggle">
    <ul>
      <li class="is-active">
        <a id="2d" value="2d">2-D</a>
      </li>
      <li>
        <a id="3d" value="3d">3-D</a>
      </li>
    </ul>
  </div>
  `));
    document.getElementById("plot").append(htmlToElement(`<div id="dim-scatter-plot"/>`));
    document.getElementById("scatter_dimensions").querySelectorAll('a').forEach(n => {
        n.addEventListener('click', e => {
            console.log(`User wants a ${e.target.getAttribute('value')} plot`);
            document.getElementById("scatter_dimensions").querySelectorAll('li').forEach(n => { n.classList = '' });
            document.getElementById(e.target.getAttribute('value')).parentElement.classList = 'is-active';
        });
    });


    scatter_2d(contents);


}




const nldr_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            coordinate_data = clean_data(e.detail.contents);
            let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;
            console.log(`Plotting a ${plot_dimension}-D plot`);
            plot_dimensions(plot_dimension, coordinate_data[Object.keys(coordinate_data)[0]]);
        }
    });

    addEventListener("NLDRPlotRequest", e => {
        console.log(`An NLDR plot has been requested for file ${e.detail.file_name}`);
        dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_name] }));
    });
}

export { nldr_plot_init };