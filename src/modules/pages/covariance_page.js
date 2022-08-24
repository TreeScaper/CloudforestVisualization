import { scalequantize } from "d3-scale";
import { forcesimulation, forcecollide, forcemanybody, forcelink, forcex, forcey, forcecenter } from "d3-force";
import { create, select } from "d3-selection";
import { drag } from "d3-drag";
import { mean, max, ascending } from "d3-array";
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { scalelinear, eas } from "d3-scale";

import { roundedrect } from "../utilities/support_funcs";
import { removechildnodes, cleanexistingplot, htmltoelement } from "../utilities/html_templates";
import { css_colors } from "../utilities/colors";
import { build_event } from "../utilities/support_funcs";
import { parse_taxa_partitions } from "../components/bipartition_data.js";
import { get_root } from "./phylogram_page.js";
import { newick_parse } from "tree_data_parsing"

const getEvent = () => event; // This is necessary when using webpack >> https://github.com/d3/d3-zoom/issues/32
const d3 = Object.assign(
    {
        mean,
        max,
        select,
        event,
        getEvent,
        scaleQuantize,
        forceSimulation, forceCollide, forceManyBody, forceLink, forceX, forceY, forceCenter,
        drag,
        hierarchy,
        ascending,
        scaleLinear,
        create
    }
);

class CovariancePage {

    // Hovering tooltip for both phylogram and covariance plot
    tooltip = null;
    guid = undefined;

    constructor() {}

    /*
     * Draw hover-over tooltip for bipartitions on both the phylogram and covariance network
     */
    draw_tooltip() {
        let x_tooltip_width_abs = 100;
        let y_tooltip_width_abs = 18;
    
        let x_tooltip_mag = (this.tooltip.x < x_tooltip_width_abs) ? -1 : 1;
        let y_tooltip_mag = (this.tooltip.y < y_tooltip_width_abs) ? -1 : 1;
    
        let x_tooltip_width = x_tooltip_mag * x_tooltip_width_abs;
        let y_tooltip_width = y_tooltip_mag * y_tooltip_width_abs;
    
        this.tooltip.ctx.beginPath();
        this.tooltip.ctx.globalAlpha = 1.0;
        this.tooltip.ctx.fillStyle = "black";
    
        // This should be adjusted to scale.
        this.tooltip.ctx.font = '18px serif';
        let x_text_loc = (x_tooltip_mag == 1) ? this.tooltip.x - x_tooltip_width + 5 : this.tooltip.x + 5;
        let y_text_loc = (y_tooltip_mag == 1) ? this.tooltip.y - 5 : this.tooltip.y  - y_tooltip_width + 5;
        this.tooltip.ctx.fillText(this.tooltip.text, x_text_loc, y_text_loc);
    }

    /**
     * Creates 2d array from raw data by splitting on newlines and tabs.
     *
     * @param {string} data Raw data
     */
    static clean_data(data) {
        let t_arr = data.split('\n');
        let arr = []
        t_arr.forEach(d => {
            if (d.length > 0) {
                arr.push(d.split('\t'));
            }
        });
        return arr;
    }

    build_publish_button() {
        // Downloads a PNG displaying both phylogram and covariance network side-by-side as they are shown.
        document.getElementById("publish-graph").addEventListener("click", () => {
            let combined_canvas = document.createElement('canvas');
            let covariance_canvas = document.getElementById('covariance-canvas');
            let tree_canvas = document.getElementById('tree-canvas');

            combined_canvas.setAttribute('width', covariance_canvas.width + tree_canvas.width);
            combined_canvas.setAttribute('height', Math.max(covariance_canvas.height,tree_canvas.height));
            let combined_ctx = combined_canvas.getContext('2d');

            combined_ctx.drawImage(tree_canvas, 0, 0);
            combined_ctx.drawImage(covariance_canvas, tree_canvas.width, 0);

            let download_link = document.createElement('a')
            download_link.href = combined_canvas.toDataURL('image/png');
            download_link.download = 'covariance_plot.png';
            download_link.click();
        });

        pcc.append(htmlToElement(`<div class="field has-addons">
        <div class="control">
            <button id="publish-graph" class="button is-info">Publish Graph</button>
        </div>`));

    }

    handle_file_event(e) {
        // User-selected file passed in event
        let cov_matrix_file_obj = e.detail.files.filter(obj => obj.name == e.detail.selected_file);
        // History item name for the covariance matrix file
        let history_item_string = cov_matrix_file_obj[0].name.match(/data [0-9]+$/)[0];
    
        // Number of the history item used as input for the Covariance Matrix file
        let history_number = parseInt(history_item_string.match(/[0-9]+/));
    
        // Find Bipartition Matrix file generated from the same history item
        let bip_matrix_regex = new RegExp(`Bipartition Matrix.*${history_item_string}$`);
        let bip_matrix_file_obj = e.detail.files.filter(obj => bip_matrix_regex.test(obj.name));
    
        // Find Bipartition Counts file generated from the same history item
        let bip_counts_regex = new RegExp(`Bipartition Counts.*${history_item_string}$`);
        let bip_counts_file_obj= e.detail.files.filter(obj => bip_counts_regex.test(obj.name));
    
        // Find Taxa IDs  file generated from the same history item
        let taxa_ids_regex = new RegExp(`Taxa IDs.*${history_item_string}$`);
        let taxa_ids_file_obj = e.detail.files.filter(obj => taxa_ids_regex.test(obj.name));
    
        // Find the original input history item used to generate the above files
        let trees_file_obj = e.detail.files.filter(obj => obj.hid == history_number);
    
        // Dispatch event requesting file contents
        dispatchEvent(build_event("FileContentsRequest", {
            guid: this.guid,
            files: [cov_matrix_file_obj.pop().dataset_id, bip_matrix_file_obj.pop().dataset_id, taxa_ids_file_obj.pop().dataset_id, bip_counts_file_obj.pop().dataset_id, trees_file_obj.pop().dataset_id]
        }));
    }

    handle_file_contents_event(e) {
        if (e.detail.guid === this.guid) {
    
            let covariance_plot = new CovariancePlot('cov-plot', 'plot-controls, plot-metadata');
            let phylogram_plot = new PhylogramPlot('tree-plot', 'plot-controls, plot-metadata');
    
            // Parse files
            e.detail.contents.forEach(file => {
                if (/^Covariance Matrix/.test(file.fileName)) {
                    let arr = file.data.split('\n');
                    covariance_plot.parse_covariance(this.clean_data(file.data));
                }
    
                if (/^Bipartition Matrix/.test(file.fileName)) {
                    covariance_plot.parse_bipartition_cov(this.clean_data(file.data));
                }
    
                if (/^Taxa IDs/.test(file.fileName)) {
                    covariance_plot.parse_taxa_array(file.data);
                }
    
                if (/^Bipartition Counts/.test(file.fileName)) {
                    covariance_plot.parse_taxa_partitions(this.clean_data(file.data));
                }
    
                if (/cloudforest.trees/.test(file.fileExt)) {
                    phylogram_plot.parse_boottree_data(file.data);
                }
            });
    
            // Create tree-plot div if it does not exist
            if (!document.getElementById("tree-plot")) {
                document.getElementById("plot").append(htmlToElement(`<div id="tree-plot" style="vertical-align: top; width: 50%; margin: 0px; padding-right: 0px; font-size:0; border: 0px; display:inline-block; overflow: visible"/>`));
            }
    
            // Create cov-plot div if it does not exist
            if (!document.getElementById("cov-plot")) {
                document.getElementById("plot").append(htmlToElement(`<div id="cov-plot" style="width: 50%; margin: 0px; padding-left: 0px; border: 0px; font-size:0; display:inline-block; overflow: visible"/>`));
            }

            // Clear existing plot control and metadata and rebuild
            removeChildNodes("plot-controls");
            removeChildNodes("plot-metadata");

            phylogram_plot.build_controls();
            covariance_plot.build_controls();
            this.build_publish_button();
    
            phylogram_plot.draw();
            covariance_plot.draw();
        }
    }


    /**
     * Initializes module for mapping covariance plot to phylogram
     *
     * @param {Object} init_obj Function for generating guid
     */
    init(init_obj) {
        // Function passed a guid function and creates a guid, which it uses for later events
        let { guid_fn } = init_obj;
        this.guid = guid_fn();

        let page = new CovariancePage();

        // Event that parses available files
        addEventListener("BipartitionFiles", page.handle_file_event);

        // Event that parses file contents
        addEventListener("FileContents", page.handle_file_contents_event);

        // Event for initial plot request
        addEventListener("CovariancePageRequest", e => {
            dispatchEvent(build_event("RequestBipartitionFile", {guid: this.guid, selected_file: e.detail.file_name}));
        });

        //User has requested that CD groups be used in plotting.
        addEventListener("UseCDGroupsTrue", e => {
            if (e.detail.type === "Cova") {
                parse_cd(e.detail.groups);
            }
        });
        //User has requested that CD groups _not_ be used in plotting.
        addEventListener("UseCDGroupsFalse", e => {
            cd_groups = undefined;
        });
    }
}

export { CovariancePage }

// DEV
//// The phylogram link and covariance bipartition being highlighted due one or the other,
//// and its associated member in the other plot.
//let current_link = null;
//let current_bipartition = null;
//
//// All links and bipartitions selected for highlighting.
//let selected_links = [];
//let selected_bipartitions = [];

// List where each entry is a list of taxa representing the bipartition corresponding with that index.
//let parsed_bipartition_taxa = undefined;

/**
 * Parses out communities and assigns corresponding colors
 *
 * @param {[]} groups Group data
 */
// DEV
//const parse_cd = function (groups) {
//    let d = {};
//    let hsl_colors = Object.keys(groups).map((v, i) => {
//        return css_colors[i];
//    });
//
//    Object.keys(groups).forEach((k, idx) => {
//        groups[k].forEach(bp => {
//            d[bp] = { group: k, color: hsl_colors[idx] };
//        });
//    });
//    cd_groups = d;
//}


/**
 * Return a profile for the requested node, including
 * link information.
 * @param {*} node
 */
// DEV
//const profile_node = function (node) {
//    let r_val = {
//        "id": node.id,
//        "num_trees": node.num_trees
//    };
//    let pos_values = [];
//    let neg_values = [];
//    graph_data.all_links.forEach(l => {
//        if (l.source === node.id || l.target === node.id) {
//            if (l.value < 0) {
//                neg_values.push(l.value);
//            }
//            if (l.value >= 0) {
//                pos_values.push(l.value);
//            }
//        }
//    });
//    r_val["num_pos_cova"] = pos_values.length;// || NaN;
//    r_val["num_neg_cova"] = neg_values.length;// || NaN;
//    r_val["mean_pos_cova"] = d3.mean(pos_values);// || NaN;
//    r_val["mean_neg_cova"] = d3.mean(neg_values) || NaN;
//    r_val["max_neg_cova"] = -1 * d3.max(neg_values.map(v => Math.abs(v))) || NaN;
//    r_val["max_pos_cova"] = d3.max(pos_values);// || NaN;
//    return r_val;
//}


/**
 * Check if bipartition is either moused over, or in selected bipartitions.
 *
 * @param {number} b Bipartition ID
 */
// DEV
// const is_highlighted_bipartition = function(b) {
//     return (b == current_bipartition || selected_bipartitions.includes(b));
// }
