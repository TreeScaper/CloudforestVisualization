import "./bulma.min.css";

import { galaxy_data_init as data_manager_init } from "./modules/galaxy_data";

// Import primary plotting modules
import { nldr_plot_init } from "./modules/nldr_plotting";
import { covariance_plot_init } from "./modules/covariance_plotting";
import { community_detection_init } from "./modules/community_detection_plotting";
import { tree_plot_init } from "./modules/phylogram_plotting";
import { affinity_chord_plot_init } from "./modules/affinity_chord_plotting";

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

    let navbar_version_banner = document.getElementById("navbar-version-banner");
    navbar_version_banner.append("Visualization tools version: " + __VERSION__);

    page_mgr_init({
        guid_fn: get_guid
    });

    nldr_plot_init({
        guid_fn: get_guid
    });

    covariance_plot_init({
        guid_fn: get_guid
    });

    community_detection_init({
        guid_fn: get_guid
    });

    pyhlogram_init({
        guid_fn: get_guid
    });

    affinity_chord_plot_init({
        guid_fn: get_guid
    });
}

const run_app = function () {
    document.querySelector("body").removeAttribute("style");

    addEventListener("DataPrimed", () => { init_modules(); });
    data_manager_init({
        conf_elem_id: "galaxy-config"
    });
}

run_app();
