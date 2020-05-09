// Module for parsing and plotting NLDR coordinate data.
import Plotly from 'plotly.js-basic-dist';

const file_name_regex = RegExp(/NLDR.*Coordinates/);
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

const parse_dimensions = function () {
    const rx = RegExp(/Dim_(\d)_/);
    let avail_dimensions = [];
    Object.keys(coordinate_data).forEach(k => {
        let m = rx.exec(k);
        if (m) {
            avail_dimensions.push(m[1]);
        }
    });
    dispatchEvent(event_buld_fn("DimensionDataReady", { dimensions: avail_dimensions }));
}


const scatter_2d = function (file_contents) {
    let axis_max_min = function (axis_data) {
        const max_mag = Math.ceil(Math.max(...axis_data.map(Math.abs)));
        let data_min = undefined;
        if (Math.min(...axis_data) < 0) {
            data_min = (-1) * max_mag;
        } else {
            data_min = Math.floor(Math.min(...axis_data));
        }
        console.log(`${data_min} ${max_mag}`);
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

    Plotly.newPlot("plot", [trace1], layout, config);
}

const nldr_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            coordinate_data = clean_data(e.detail.contents);
            parse_dimensions();
        }
    });

    addEventListener("AvailableFiles", e => {
        let foi = undefined;
        Object.keys(e.detail).forEach(k => {
            foi = e.detail.files.filter(f => file_name_regex.test(f));
        });
        dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: foi }));
    });

    addEventListener("PlotNLDRDim", e => {
        console.log(`Generating a ${e.detail.dimension} dimenson plot.`);
        switch (e.detail.dimension) {
            case 2:
                scatter_2d(coordinate_data["NLDR_Dim_3_Coordinates"]);
                break;

            default:
                break;
        }
    });

    dispatchEvent(event_buld_fn("AvailableFilesRequest", { guid: my_guid }));
}

export { nldr_plot_init };