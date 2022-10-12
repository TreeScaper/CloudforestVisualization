//Module to handle UI <-> human
import { htmlToElement } from "./utilities/html_templates";
import { build_event } from "./utilities/support_funcs";
import { CovariancePage } from "./pages/covariance_page.js"
import { determine_default_cd_files } from "./pages/community_detection_page.js";

let select_objs = {
    "nldr-select": {
        name: "NLDR",
        file_set:  [
            {
                name: 'nldr_coordinates',
                display_name: 'NLDR Coordinates',
                regex: [RegExp(/^NLDR Coordinates/)],
                files: []
            }
        ],
        event: "NLDRPageRequest"
    },
    "tree-select": {
        name: "Tree Diagram",
        file_set:  [
            {
                name: 'trees',
                display_name: 'Tree File',
                regex: [RegExp(/cloudforest\.trees/), RegExp(/^Consensus Tree/), RegExp(/Affinity Matrix/i)],
                files: []
            }
        ],
        event: "TreePageRequest"
    },
    "cd-select": {
        name: "Community Detection",
        default_file_function: determine_default_cd_files,
        file_set:  [
            {
                name: 'plateaus',
                display_name: 'Community Detection Plateaus',
                regex: [RegExp(/CD Plateaus/i)],
                files: []
            },
            {
                name: 'nldr_coordinate_file',
                display_name: 'NLDR Coordinate File',
                regex: [RegExp(/NLDR Coordinates/i)],
                files: []
            },
            {
                name: 'cd_results',
                display_name: 'Community Detection Results',
                regex: [RegExp(/CD Results/i)],
                files: []
            }
        ],
        event: "CDPageRequest"
    },
    "affinity-select": {
        name: "Affinity Matrix",
        file_set:  [
            {
                name: 'affinity_matrix',
                display_name: 'Affinity Matrix',
                regex: [RegExp(/Affinity Matrix/i)],
                files: []
            }
        ],
        event: "AffinityPageRequest"
    },
    "covariance-select": {
        name: "Covariance Plotting",
        default_file_function: CovariancePage.determine_default_files,
        file_set: [
            {
                name: 'covariance_matrix',
                display_name: 'Covariance Matrix',
                regex: [RegExp(/Covariance Matrix/i)],
                files: []
            },
            {
                name: 'bipartition_matrix',
                display_name: 'Bipartition Matrix',
                regex: [RegExp(/Bipartition Matrix/i)],
                files: []
            },
            {
                name: 'bipartition_counts',
                display_name: 'Bipartition Counts',
                regex: [RegExp(/Bipartition Counts/i)],
                files: []
            },
            {
                name: 'taxa_ids',
                display_name: 'Taxa IDs',
                regex: [RegExp(/Taxa IDs/i)],
                files: []
            },
            {
                name: 'tree_file',
                display_name: 'Tree File',
                regex: [RegExp(/cloudforest\.trees/)],
                files: []
            }
        ],
        event: "CovariancePageRequest"
    }
};


const get_selected_file_ids = function () {
    let file_select = document.getElementsByClassName('file-select');
    let selected_files = {};
    for (const f of file_select) {
        selected_files[f.id] = f.options[f.selectedIndex].getAttribute('data_id');
    }
    return selected_files;
}


/*
 * Populates select menus for visualization type & file.
 */
const populate_visualizations = function (files) {

    document.getElementById('visualization-select').disabled = false;
    let te = document.getElementById('visualization-select');

    Object.keys(select_objs).forEach(k => {
        let obj = select_objs[k];
        let select_obj_name = obj.name;
        let s = `<option visualization-key="${k}">${select_obj_name}</option>`;
        te.append(htmlToElement(s));
    })

    te.addEventListener("change", e => {

        let file_select_menu = document.getElementById('file-select-menu');

        while (file_select_menu.firstChild) {
            file_select_menu.removeChild(file_select_menu.firstChild);
        }

        if (e.target.selectedIndex > 0) {

            let visualization_key = e.target.children[e.target.selectedIndex].getAttribute('visualization-key');
            let select_obj = select_objs[visualization_key];

            let run_button = document.getElementById('run-visualization-button');
            run_button.addEventListener("click", e => {
                dispatchEvent(build_event(select_objs[visualization_key].event, {
                    file_ids: get_selected_file_ids()
                }));
            });

            let default_files = undefined;
            if ('default_file_function' in select_obj) {
                default_files = select_obj.default_file_function(files);
            }

            let table = document.createElement('table');
            file_select_menu.append(table);
            let tbody = document.createElement('tbody');
            table.append(tbody);

            select_obj.file_set.forEach(set_item => {

                let tr = document.createElement('tr');
                tbody.append(tr);

                // This is of the Bulma "select" class
                let file_select_div = document.createElement('div');
                file_select_div.setAttribute('class', 'select file-select-div');

                let label_header = document.createElement('h2');
                label_header.textContent = set_item.display_name;
                label_header.setAttribute('class', 'file-select-label');
                //file_select_div.append(label_header);

                let header_td = document.createElement('td');
                header_td.append(label_header);
                tr.append(header_td);

                let select_td = document.createElement('td');
                select_td.append(file_select_div);
                tr.append(select_td);

                let file_select = document.createElement('select');
                file_select.setAttribute('class', 'is-small file-select');
                file_select.setAttribute('id', `${set_item.name}-select`);

                let default_file = undefined;
                let default_option = document.createElement('option');

                if (default_files != undefined) {
                    default_file = default_files[set_item.name];
                    default_option.setAttribute('class', 'file-list-option');
                    default_option.setAttribute('data_id', default_file.id);
                    default_option.setAttribute('data_name', default_file.name);
                    default_option.textContent = default_file.name;
                } else {
                    default_option.setAttribute('value', '');
                    default_option.textContent = '--Please choose a file--';
                }

                file_select.append(default_option);

                // For the selection visualization file set item, add the associated files
                // DEV we should have a function for each visualization that tries to determine the best default options
                set_item.files.forEach(f => {
                    if (default_file == undefined || f.id != default_file.id) {
                        let option = document.createElement('option');
                        option.setAttribute('class', 'file-list-option');
                        option.setAttribute('data_id', f.id);
                        option.setAttribute('data_name', f.name);
                        option.textContent = f.name;
                        file_select.append(option);
                    }
                });
                file_select_div.append(file_select);
                //file_select_menu.append(file_select_div);

                // For the file select, add an event listener the spawns the visualization when a file is selected
                // DEV - we should have a generate visualization button if we're going to require multiple input files

            });
        }
    });
}


const process_available_files = function (files) {

    let process_obj = function (obj) {
        obj.regex.forEach(rx => {
            files.forEach(f => {
                if (rx.test(f.name)) {
                    obj.files.push(f);
                }
                if (rx.test(f.extension)) {
                    obj.files.push(f);
                }
            });
        });
    }

    Object.keys(select_objs).forEach(k => {
        let obj = select_objs[k];

        obj.file_set.forEach(file_set_item => {
            process_obj(file_set_item);
        });
    });
}

const page_mgr_init = function (init_obj) {
    const { guid_fn } = init_obj;
    const my_guid = guid_fn();

    addEventListener("AvailableFiles", e => {
        process_available_files(e.detail.files);
        populate_visualizations(e.detail.files);
    });

    dispatchEvent(build_event("AvailableFilesRequest", { guid: my_guid }));
}

export { page_mgr_init }
