import "./bulma.min.css";

import { data_manager_init } from "./modules/dev_datamanager";
import { nldr_plot_init } from "./modules/nldr_plotting";


const get_guid = function () {
    let array = new Uint32Array(2);
    window.crypto.getRandomValues(array);
    let msg_guid = array.join('');
    return msg_guid;
}

const build_event = function (name, details) {
    return new CustomEvent(name, {
        bubbles: true,
        detail: details
    });
}

const dimension_plot_tasks = function (dimensions) {
    let m = Math.max(...dimensions.map(e => Number(e)));
    if (m <= 3) {
        document.getElementById(`dim_2`).disabled = false;
        document.getElementById(`dim_3`).disabled = false;
    }
    if (m > 3) {
        document.getElementById(`dim_4`).disabled = false;
    }
}

const dom_prep = function () {
    [["dim_2", 2], ["dim_3", 3], ["dim_4", 4]].forEach(item => {
        document.getElementById(item[0]).addEventListener('click', () => {
            dispatchEvent(build_event("PlotNLDRDim", { dimension: item[1] }));
        });
    });
}

const run_app = function () {
    document.querySelector("body").removeAttribute("style");
    dom_prep();

    data_manager_init({});

    addEventListener("DimensionDataReady", e => {
        dimension_plot_tasks(e.detail.dimensions);
    });

    nldr_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });

}

run_app();