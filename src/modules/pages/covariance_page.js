import { scalequantize } from "d3-scale";
import { create, select } from "d3-selection";
import { drag } from "d3-drag";
import { mean, max, ascending } from "d3-array";
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { scaleLinear, eas } from "d3-scale";

import { roundedrect } from "../utilities/support_funcs";
import { removeChildNodes, htmlToElement } from "../utilities/html_templates";
import { css_colors } from "../utilities/colors";
import { build_event } from "../utilities/support_funcs";
import { newick_parse } from "../components/tree_data_parsing"
import { PhylogramPlot } from "../components/phylogram_plot.js"
import { CovariancePlot } from "../components/covariance_plot.js"

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

    static build_publish_button() {
        let pcc = document.getElementById('plot-controls');
        pcc.append(htmlToElement(`<div class="field has-addons">
        <div class="control">
            <button id="publish-graph" class="button is-info">Publish Graph</button>
        </div>`));

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

    build_mouseover_action(covariance_canvas, phylogram_canvas) {

        // Called when user moves their mouse over the canvas. This allows for the inspecting and selecting
        // of specific bipartitions in the network.
        // DEV Commented out at this stage of development
        covariance_canvas.addEventListener("mousemove", function(e) {

            // Get coordinates of the canvas element in the browser page.
            let canvas_rect = covariance_canvas.getBoundingClientRect();

            // This represents the X and Y in relation to the canvas element.
            let x = e.clientX - canvas_rect.left, y = e.clientY - canvas_rect.top;

            // Will be set to a bipartition that is found to be under the user's mouse.
            let found_bipartition = null;

            // Iterate through each node.
            for (const d of graph_data.nodes) {

                // Find distance between user's mouse and center of the node.
                let dist = Math.sqrt(Math.pow(x - d.x, 2) + Math.pow(y - d.y, 2));

                // If that distance is less than the node radius, the user's mouse is found to be within the node drawing,
                // Use the slightly larger highlighted radius for an extra margin in which the node becomes highlighted.
                //if (dist < highlight_cov_node_r) {
                if (dist < highlight_cov_node_r) {

                    // Get the set of taxa representing the moused over bipartition.
                    let bipartition_set = new Set(parsed_bipartition_taxa[plot_element.id]);

                    // Iterate through links in the phylogram
                    for (const t of tree_links) {

                        // For each phylogram link, representing a bipartition, find the associated taxa.
                        let leaf_names = [];
                        for (const leaf of t.link.target.leaves()) {
                            leaf_names.push(leaf.data.name);
                        }
                        let leaves_set = new Set(leaf_names);

                        // If the taxa both from the covariance network bipartition (node), and the phylogram bipartition (link) are equal
                        // they are the same bipartition. Select the found link as the current_link, which means it will be highlighted.
                        if (set_equality(leaves_set, bipartition_set)) {
                            current_link = t;
                        }
                    }

                    // Node the bipartition we found under the mouse and break.
                    found_bipartition = d.id;
                    break;
                }
            }

            // If we found a bipartition under the mouse, set the current_bipartition, redraw both phylogram and covariance network, and the tooltip.
            if (found_bipartition !== null) {
                if (current_bipartition !== found_bipartition) {
                    current_bipartition = found_bipartition;
                }
                draw_covariance();
                draw_phylogram();
                tooltip = {
                    ctx: ctx,
                    x: x,
                    y: y,
                    text: `Bipartition ${found_bipartition}`
                };
                draw_tooltip();

            // If we found nothing, and there was in the previous mouseover event a bipartition under the mouse (the mouse is moving out of a node),
            // clear tooltip, current link and bipartition, and redraw visualization.
            } else {
                tooltip = null;
                if (current_bipartition !== null) {
                    current_link = null;
                    current_bipartition = null;
                    draw_covariance();
                    draw_phylogram();
                }
            }
        });

        // When a bipartition node is clicked, its added to the list of selected bipartitions and both it and its corresponding bipartition in phylogram (if it
        // exists) are highlighted until another node is selected. Holding shift allows for the selection, and deselecting, of multiple nodes.
        covariance_canvas.addEventListener("click", function(e) {
            if (current_bipartition != null) {
                if (!selected_bipartitions.includes(current_bipartition)){
                    if (e.shiftKey) {
                        selected_bipartitions.push(current_bipartition);
                        selected_links.push(current_link);
                    } else {
                        selected_bipartitions = [current_bipartition];
                        selected_links = [current_link];
                    }
                } else {
                    selected_bipartitions = selected_bipartitions.filter(b => b != current_bipartition);
                    selected_links = selected_links.filter(b => b != current_link);
                }
            }
        });
        
        phylogram_canvasaddEventListener("mousemove", function(e) {
            let event_date = Date.now()
            let canvas_rect = phylogram_canvasgetBoundingClientRect();
            let x = e.clientX- canvas_rect.left, y = e.clientY- canvas_rect.top;
            let found_link = null;
            for (const t of tree_links) {
               let on_link = false;

               this.create_empty_line(ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.source.x, t.scaled_coord.target.y);
               if (ctx.isPointInStroke(x, y) && t.link.target.children !== undefined) {
                   on_link = true;
               }

               this.create_empty_line(ctx, t.scaled_coord.source.x, t.scaled_coord.target.y, t.scaled_coord.target.x, t.scaled_coord.target.y);
               if (ctx.isPointInStroke(x, y) && t.link.target.children !== undefined) {
                   on_link = true;
               }

               if (on_link) {
                    let leaf_names = [];
                    for (const leaf of t.link.target.leaves()) {
                        leaf_names.push(leaf.data.name);
                    }
                    let leaves_set = new Set(leaf_names);
                    for (const [bipartition_num, bipartition_leaves] of Object.entries(parsed_bipartition_taxa)) {
                        let bipartition_set = new Set(bipartition_leaves);
                        if (set_equality(leaves_set, bipartition_set)) {
                            this.current_bipartition = bipartition_num;
                        }
                    }
                    found_link = t;
                    break;
               }
            }

            if (found_link !== null) {
                if (current_link !== found_link) {
                    current_link = found_link;
                }
                redraw_full_cov_graph();
                draw_phylogram();
                if (this.current_bipartition !== null) {
                    tooltip = {
                        ctx: ctx,
                        x: x,
                        y: y,
                        text: `Bipartition ${this.current_bipartition}`
                    };
                    draw_tooltip();
                }
            } else {
                tooltip = null;
                if (current_link !== null) {
                    current_link = null;
                    this.current_bipartition = null;
                    redraw_full_cov_graph();
                    draw_phylogram();
                }
            }
        });

        // This function is similar to the mousemove event for the covariance network in this same file.
        phylogram_canvasaddEventListener("click", function(e) {
            if (current_link != null) {
                if (!selected_links.includes(current_link)){
                    if (e.shiftKey) {
                        selected_links.push(current_link);
                        if (this.current_bipartition != null) {
                            selected_bipartitions.push(this.current_bipartition);
                        }
                    } else {
                        selected_links = [current_link];
                        if (this.current_bipartition != null) {
                            selected_bipartitions = [this.current_bipartition];
                        }
                    }
                } else {
                    selected_links = selected_links.filter(b => b != current_link);
                    if (this.current_bipartition != null) {
                        selected_bipartitions = selected_bipartitions.filter(b => b != this.current_bipartition);
                    }
                }
            }
        });
    }

    handle_file_contents_event(e) {
        if (e.detail.guid === this.guid) {
    
            let covariance_plot = new CovariancePlot('cov-plot', 'plot-controls', 'plot-metadata');
            let phylogram_plot = new PhylogramPlot('tree-plot', 'plot-controls', 'plot-metadata');
    
            // Parse files
            e.detail.contents.forEach(file => {
                if (/^Covariance Matrix/.test(file.fileName)) {
                    let arr = file.data.split('\n');
                    covariance_plot.parse_covariance(CovariancePage.clean_data(file.data));
                }
    
                if (/^Bipartition Matrix/.test(file.fileName)) {
                    covariance_plot.parse_bipartition_cov(CovariancePage.clean_data(file.data));
                }
    
                if (/^Taxa IDs/.test(file.fileName)) {
                    covariance_plot.parse_taxa_array(file.data);
                }
    
                if (/^Bipartition Counts/.test(file.fileName)) {
                    covariance_plot.parse_taxa_partitions(CovariancePage.clean_data(file.data));
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
            CovariancePage.build_publish_button();
    
            phylogram_plot.draw();
            covariance_plot.draw();
            // DEV
            //build_mouseover_action();
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
