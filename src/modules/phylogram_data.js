import { removeChildNodes } from "./html_templates";
import { newick_parse } from "./tree_data_parsing";

let data_files = undefined;
let event_build_fn = undefined;

/**
 * Handles bootstrapped tree data and phylogram plotting.
 * @param {*} init_obj 
 */
const pyhlogram_data_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    //event_build_fn("TreeSVG", { tree: tree_svg });
    addEventListener("TreeSVG", e => {
        document.getElementById("plot-metadata").append(e.tree);
        document.getElementById("plot-metadata").scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    });

    addEventListener("TreeRequest", e => {
        let tree_num = e.detail.tree_number;
        if (data_files.length > 1) {
            //TODO: Ask the user
        } else {
            removeChildNodes("plot-metadata");
            let f = data_files[Object.keys(data_files)[0]];
            let parsed_data = newick_parse(f[tree_num][0]);
            event_build_fn("PlotForTree", {
                tree: parsed_data,
                width: document.getElementById("plot-metadata").getAttribute("width"),
                height: document.getElementById("plot-metadata").getAttribute("height")
            })

            chart_phylogram({
                parsed_data: newick_parse(f[tree_num][0]),
                dom_id: "plot-metadata",
                tree_id: tree_num
            });

        }
    });

    addEventListener("BootstrappedTreeData", e => {
        //Expecting all data files containing bootstrapped trees
        data_files = e.detail.contents;
    });

    dispatchEvent(event_build_fn("BootstrappedTrees", { guid: my_guid }))
}

export { pyhlogram_data_init }