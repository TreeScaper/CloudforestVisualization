//Module to handle UI <-> human
import { htmlToElement } from "./utilities/html_templates";
import { build_event } from "./utilities/support_funcs";

let select_objs = {
    "nldr-select": {
        name: "NLDR",
        regex: [RegExp(/^NLDR Coordinates/)],
        files: [],
        event: "NLDRPageRequest"
    },
    "tree-select": {
        name: "Tree Diagram",
        regex: [RegExp(/cloudforest\.trees/), RegExp(/^Consensus Tree/), RegExp(/Affinity Matrix/i)],
        files: [],
        event: "TreePageRequest"
    },
    "cd-select": {
        name: "Community Detection",
        regex: [RegExp(/CD Plateaus/i), RegExp(/CD with NLDR coordinates/i), RegExp(/CD Results/i)],
        files: [],
        event: "CDPageRequest"
    },
    "affinity-select": {
        name: "Affinity Matrix",
        regex: [RegExp(/Affinity Matrix/i)],
        files: [],
        event: "AffinityPageRequest"
    },
    "covariance-select": {
        name: "Covariance Plotting",
        regex: [RegExp(/Covariance Matrix/i)],
        files: [],
        event: "CovariancePageRequest"
    }
};



/*
 * Populates select menus for visualization type & file.
 */
const populate_visualizations = function () {
    document.getElementById('visualization-select').disabled = false;
    let te = document.getElementById('visualization-select');
    Object.keys(select_objs).forEach(k => {
        let select_obj_name = select_objs[k].name;
        let s = `<option viz_key="${k}">${select_obj_name}</option>`;
        te.append(htmlToElement(s));
    })

    te.addEventListener("change", e => {
        let viz_interface = document.getElementById('file-select-menu');
        if (e.target.selectedIndex > 0) {
            let viz_key = e.target.children[e.target.selectedIndex].getAttribute('viz_key');
            //if (viz_key === "covariance-select" || viz_key === "cd-select") {
            //    console.log("Matching viz_key", viz_key);
            //    dispatchEvent(build_event(select_objs[viz_key].event, {}));
            //    return;
            //}

            let file_select_el = document.getElementById("file-select");
            if (document.contains(file_select_el)) {
                file_select_el.parentNode.removeChild(file_select_el);
            }
            viz_interface.append(htmlToElement('<select id="file-select" class="is-small">'));
            file_select_el = document.getElementById("file-select");
            file_select_el.append(htmlToElement('<option value="">--Please choose a file--</option>'));


            select_objs[viz_key].files.forEach(f => {
                let s = `<option class='file-list-option' data_id="${f.id}" data_name="${f.name}">${f.name}</option>`;
                document.getElementById('file-select').append(htmlToElement(s));
            });

            file_select_el.addEventListener("change", e => {
                if (e.target.selectedIndex > 0) {
                    dispatchEvent(build_event(select_objs[viz_key].event, {
                        file_name: e.target.children[e.target.selectedIndex].getAttribute('data_name'),
                        file_id: e.target.children[e.target.selectedIndex].getAttribute('data_id')
                    }));
                }
            });
        }
    });
}


/**
 * Wires the page allowing the user to select specific files for visualization.
 */
const wire_page = function () {
    Object.keys(select_objs).forEach(k => {
        let te = document.getElementById(k);
        te.addEventListener("change", e => {
            if (e.target.selectedIndex > 0) {
                dispatchEvent(build_event(select_objs[k].event, {
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
}

const page_mgr_init = function (init_obj) {
    const { guid_fn } = init_obj;
    const my_guid = guid_fn();

    addEventListener("AvailableFiles", e => {
        process_available_files(e.detail.files);
        populate_visualizations();
    });

    dispatchEvent(build_event("AvailableFilesRequest", { guid: my_guid }));
}

export { page_mgr_init }
