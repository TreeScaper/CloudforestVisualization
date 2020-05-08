// Module for parsing and plotting NLDR coordinate data.

const file_name_regex = RegExp(/NLDR.*Coordinates/);
let coordinate_data = undefined;

const clean_data = function (data) {
    let cleaned = {};
    Object.keys(data).forEach(k => {
        cleaned[k] = data[k].map(row => {
            return row.filter(f => f.length > 0).map(i => Number(i));
        });
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
    dispatchEvent(new CustomEvent('DimensionDataReady', {
        bubbles: true,
        detail: { dimensions: avail_dimensions }
    }));
}


const nldr_plot_init = function (init_obj) {
    let { guid_fn } = init_obj;
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
        dispatchEvent(new CustomEvent('FileContentsRequest', {
            bubbles: true,
            detail: { guid: my_guid, files: foi }
        }));
    });

    addEventListener("PlotNLDRDim", e => {

    });

    dispatchEvent(new CustomEvent('AvailableFilesRequest', {
        bubbles: true,
        detail: { guid: my_guid }
    }));
}

export { nldr_plot_init };