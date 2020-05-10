//Module to handle UI <-> human
import { htmlToElement } from "./html_templates";

let event_build_fn = undefined
let select_objs = {
    "nldr-select": {
        regex: [RegExp(/NLDR.*Coordinates.*/)],
        files: []
    },
    "tree-select": {
        regex: [RegExp(/Affinity Matrix/), RegExp(/Bipartition/), RegExp(/[Cc]onsensus [Tt]ree/)],
        files: []
    },
    "cd-select": {
        regex: [RegExp(/Community Results/), RegExp(/Community Plateaus/)],
        files: []
    }
};

const populate_selects = function () {
    Object.keys(select_objs).forEach(k => {
        select_objs[k].files.forEach(f => {
            let s = `<option>${f}</option>`;
            document.getElementById(k).append(htmlToElement(s));
        });
        if (select_objs[k].files.length > 0) {
            console.log(k);
            document.getElementById(k).disabled = false;
        }
    });
}

const process_available_files = function (files) {
    Object.keys(select_objs).forEach(k => {
        select_objs[k].regex.forEach(rx => {
            files.forEach(f => {
                if (rx.test(f)) {
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

    dispatchEvent(event_build_fn("AvailableFilesRequest", { guid: my_guid }));
    addEventListener("AvailableFiles", e => {
        process_available_files(e.detail.files);
    });
}

export { page_mgr_init }