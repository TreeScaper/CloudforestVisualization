//Module to handle UI <-> human
import { htmlToElement } from "./html_templates";

let event_build_fn = undefined
let select_objs = {
    "nldr-select": {
        regex: [RegExp(/NLDR.*Coordinates.*/)],
        files: [],
        event: "NLDRPlotRequest"
    },
    "tree-select": {
        regex: [RegExp(/[Bb]oottrees/), RegExp(/Affinity Matrix/), RegExp(/Covariance Matrix/), RegExp(/[Cc]onsensus [Tt]ree/)],
        files: [],
        event: "TreePlotRequest"
    },
    "cd-select": {
        regex: [RegExp(/Community Results/)],// RegExp(/Community Plateaus/)],
        files: [],
        event: "CDPlotRequest"
    }
};

const wire_page = function () {
    Object.keys(select_objs).forEach(k => {
        document.getElementById(k)
            .querySelectorAll('option')
            .forEach(n => {
                n.addEventListener("click", e => {
                    dispatchEvent(event_build_fn(select_objs[k].event, {
                        file_name: e.target.getAttribute("data_name"),
                        file_id: e.target.getAttribute("data_id")
                    }));
                })
            })
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