//Module to handle UI <-> human
import { htmlToElement } from "./html_templates";

let event_build_fn = undefined
let select_objs = {
    "nldr-select": {
        regex: [RegExp(/^NLDR Coordinates/)],
        files: [],
        event: "NLDRPlotRequest"
    },
    "tree-select": {
        regex: [RegExp(/cloudforest\.trees/), RegExp(/^Consensus Tree/), RegExp(/^Covariance Matrix/)],
        files: [],
        event: "TreePlotRequest"
    },
    "cd-select": {
        regex: [RegExp(/Plateaus of CD result/i), RegExp(/CD with NLDR coordinates/i), RegExp(/CD Results/i)],
        files: [],
        event: "CDPlotRequest"
    }
};

/**
 * Wires the page allowing the user to select specific files for visualization.
 */
const wire_page = function () {
    Object.keys(select_objs).forEach(k => {
        let te = document.getElementById(k);
        te.addEventListener("change", e => {
            if (e.target.selectedIndex > 0) {
                dispatchEvent(event_build_fn(select_objs[k].event, {
                    file_name: e.target.children[e.target.selectedIndex].getAttribute('data_name'),
                    file_id: e.target.children[e.target.selectedIndex].getAttribute('data_id')
                }));
                //Resetting other selects to index 0
                document.querySelectorAll('select').forEach(s => {
                    if (s.getAttribute('id') != te.getAttribute('id')) {
                        s.selectedIndex = 0;
                    }
                });
            }
        });
    });
}

const populate_selects = function () {
    ///{ name: f_obj.name, id: f_obj.dataset_id }
    Object.keys(select_objs).forEach(k => {
        select_objs[k].files.forEach(f => {
            let s = `<option data_id="${f.id}" data_name="${f.name}">${f.name}</option>`;
            document.getElementById(k).append(htmlToElement(s));
        });
        if (select_objs[k].files.length > 0) {
            document.getElementById(k).disabled = false;
        }
    });
    wire_page();
}

const process_available_files = function (files) {
    //{ name: f_obj.name, id: f_obj.dataset_id }
    Object.keys(select_objs).forEach(k => {
        select_objs[k].regex.forEach(rx => {
            files.forEach(f => {
                if (rx.test(f.name)) {
                    select_objs[k].files.push(f);
                }
                if (rx.test(f.extension)) {
                    select_objs[k].files.push(f);
                }
            });
        });
    });
    populate_selects();
}

const page_mgr_init = function (init_obj) {
    const { guid_fn, event_fn } = init_obj;
    const my_guid = guid_fn();
    event_build_fn = event_fn;

    addEventListener("AvailableFiles", e => {
        process_available_files(e.detail.files);
    });

    dispatchEvent(event_build_fn("AvailableFilesRequest", { guid: my_guid }));
}

export { page_mgr_init }