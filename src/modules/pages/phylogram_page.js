/**
 * Creates a traditional phylogenetic tree respecting supplied distances
 *
 * Generates and returns an svg element based on event request.
 */
import { removeChildNodes, htmlToElement } from "../utilities/html_templates";
import { PhylogramPlot } from "../components/phylogram_plot.js"
import { get_file_contents } from "../data_manager";
import { clear_plot } from "../utilities/support_funcs";
import * as constants from "../utilities/constants";

const phylogram_page_init = function() {
    let file_contents_callback = (contents) => {
        let file = contents[0];

        let plot_element = document.getElementById(constants.plot_id);
        clear_plot();

        plot_element.append(htmlToElement(`<div id="tree-plot" style="vertical-align: top; width: 50%; margin: 0px; padding-right: 0px; font-size:0; border: 0px; display:inline-block; overflow: visible"/>`));

        removeChildNodes(constants.plot_controls_id);
        removeChildNodes(constants.plot_metadata_id);

        let phylogram_plot = new PhylogramPlot({"boottree_data": file.data});
    }

    addEventListener("TreePageRequest", e => {
        get_file_contents(Object.entries(e.detail.file_ids).map(entry => entry[1]), file_contents_callback);
    });
}


export { phylogram_page_init }
