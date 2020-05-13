import "./bulma.min.css";

import { data_manager_init } from "./modules/dev_datamanager";
import { nldr_plot_init } from "./modules/nldr_plotting";
import { affinity_plot_init } from "./modules/affinity_plotting";
import { hierarchy_plot_init } from "./modules/hierarchy_plotting";
import { covariance_plot_init } from "./modules/covariance_plotting";
import { community_detection_init } from "./modules/community_detection_plotting";
import { pyhlogram_plot_init } from "./modules/phylogram";

import { page_mgr_init } from "./modules/page_manager";

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

const init_modules = function () {
    page_mgr_init({
        guid_fn: get_guid,
        event_fn: build_event
    });

    affinity_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
    nldr_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
    covariance_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
    hierarchy_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
    community_detection_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
    pyhlogram_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
}

const run_app = function () {
    document.querySelector("body").removeAttribute("style");
    addEventListener("DataPrimed", () => { init_modules(); });
    data_manager_init({
        guid_fn: get_guid,
        event_fn: build_event,
        conf_elem_id: "galaxy_config"
    });
}

run_app();