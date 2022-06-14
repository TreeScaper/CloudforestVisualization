import "./bulma.min.css";

import { galaxy_data_init as data_manager_init } from "./modules/galaxy_data";

// Import primary plotting modules
import { nldr_page_init } from "./modules/pages/nldr_page";
import { covariance_page_init } from "./modules/pages/covariance_page";
import { community_detection_page_init } from "./modules/pages/community_detection_page";
import { phylogram_page_init } from "./modules/pages/phylogram_page";
import { affinity_chord_page_init } from "./modules/pages/affinity_chord_page";

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

    nldr_page_init({
        guid_fn: get_guid
    });

    covariance_page_init({
        guid_fn: get_guid
    });

    community_detection_page_init({
        guid_fn: get_guid
    });

    pyhlogram_page_init({
        guid_fn: get_guid
    });

    affinity_chord_page_init({
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
