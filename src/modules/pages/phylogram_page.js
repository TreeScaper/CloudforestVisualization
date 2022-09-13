/**
 * Creates a traditional phylogenetic tree respecting supplied distances
 *
 * Generates and returns an svg element based on event request.
 */
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { create, select } from "d3-selection";
import { ascending } from "d3-array";
import { scaleLinear, eas } from "d3-scale";
import { removeChildNodes, htmlToElement } from "../utilities/html_templates";
import { build_event } from "../utilities/support_funcs";
import { PhylogramPlot } from "../components/phylogram_plot.js"
import { CovariancePlot } from "../components/covariance_plot.js"

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending, scaleLinear }
);

class PhylogramPage {

    guid = undefined;

    constructor() {}

    init(init_obj) {
        let { guid_fn } = init_obj;
        this.guid = guid_fn();

        addEventListener("TreeFileContents", e => {
            if (e.detail.guid === this.guid) {
                e.detail.contents.forEach(file => {

                    let phylogram_plot = new PhylogramPlot('tree-plot', 'plot-controls', 'plot-metadata');

                    // Create tree-plot div if it does not exist
                    if (!document.getElementById("tree-plot")) {
                        document.getElementById("plot").append(htmlToElement(`<div id="tree-plot" style="vertical-align: top; width: 50%; margin: 0px; padding-right: 0px; font-size:0; border: 0px; display:inline-block; overflow: visible"/>`));
                    }

                    // DEV
                    //if (/consensus tree/i.test(item.fileName)) {
                    //}

                    phylogram_plot.parse_boottree_data(file.data);

                    removeChildNodes("plot-controls");
                    removeChildNodes("plot-metadata");

                    phylogram_plot.build_controls();
                    phylogram_plot.draw();
                })
    
            }
        });
        addEventListener("TreePageRequest", e => {
            dispatchEvent(build_event("TreeFileContentsRequest", { guid: this.guid, files: [e.detail.file_id] }));
        });
    }
}

export { PhylogramPage }
