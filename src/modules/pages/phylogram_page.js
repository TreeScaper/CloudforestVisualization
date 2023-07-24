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
import { get_file_contents } from "../data_manager";

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending, scaleLinear }
);

class PhylogramPage {

    guid = undefined;

    constructor() {}

    init() {

        let file_contents_callback = (contents) => {

            // DEV This code shouldn't be in a forEach, but it's
            // always just one file.
            contents.forEach(file => {

                let plot_element = document.getElementById('plot');
                while (plot_element.firstChild) {
                    plot_element.removeChild(plot_element.firstChild);
                }

                plot_element.append(htmlToElement(`<div id="tree-plot" style="vertical-align: top; width: 50%; margin: 0px; padding-right: 0px; font-size:0; border: 0px; display:inline-block; overflow: visible"/>`));

                let phylogram_plot = new PhylogramPlot('tree-plot', 'plot-controls', 'plot-metadata');

                // DEV
                //if (/consensus tree/i.test(item.fileName)) {
                //}

                phylogram_plot.parse_boottree_data(file.data);

                removeChildNodes("plot-controls");
                removeChildNodes("plot-metadata");

                phylogram_plot.build_controls();
                phylogram_plot.build_trees();
                phylogram_plot.draw();
            })

        }

        addEventListener("TreePageRequest", e => {
            get_file_contents(Object.entries(e.detail.file_ids).map(entry => entry[1]), file_contents_callback);
        });
    }
}

export { PhylogramPage }
