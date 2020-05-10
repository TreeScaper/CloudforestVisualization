import "./bulma.min.css";

import { data_manager_init } from "./modules/dev_datamanager";
import { nldr_plot_init } from "./modules/nldr_plotting";
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

const run_app = function () {
    document.querySelector("body").removeAttribute("style");

    data_manager_init({});

    page_mgr_init({
        guid_fn: get_guid,
        event_fn: build_event
    });
    nldr_plot_init({
        guid_fn: get_guid,
        event_fn: build_event
    });

}

run_app();