import { removeChildNodes } from "./html_templates";
import { newick_parse } from "./tree_data_parsing";
import { build_event } from "./support_funcs";

let data_files = undefined;

/**
 * Handles bootstrapped tree data and phylogram plotting.
 * @param {*} init_obj 
 */
const pyhlogram_data_init = function (init_obj) {
    let { guid_fn } = init_obj;
    const my_guid = guid_fn();

    addEventListener("TreeRequest", e => {
        let tree_num = e.detail.tree_number;
        if (data_files.length > 1) {
            //TODO: Ask the user
        } else {
            removeChildNodes("plot-metadata");
            let f = data_files[0];
            let parsed_data = newick_parse(f.data.split(/\n/)[tree_num]);
            dispatchEvent(build_event("PlotForTree", {
                tree: parsed_data,
                tree_num: tree_num + 1,
                width: document.getElementById("plot").clientWidth,
                height: .5 * document.getElementById("plot").clientWidth,
                plot_div: "plot-metadata"
            }));
        }
    });

    addEventListener("BootstrappedTreeData", e => {
        //Expecting all data files containing bootstrapped trees
        data_files = e.detail.contents;
    });

    dispatchEvent(build_event("BootstrappedTrees", { guid: my_guid }))
}

export { pyhlogram_data_init }
