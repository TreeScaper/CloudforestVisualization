import { scalequantize } from "d3-scale";
import { create, select } from "d3-selection";
import { drag } from "d3-drag";
import { mean, max, ascending } from "d3-array";
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { scaleLinear, eas } from "d3-scale";

import { roundedrect, set_equality } from "../utilities/support_funcs";
import { removeChildNodes, htmlToElement } from "../utilities/html_templates";
import { css_colors } from "../utilities/colors";
import { build_event } from "../utilities/support_funcs";
import { PhylogramPlot } from "../components/phylogram_plot.js"
import { CovariancePlot } from "../components/covariance_plot.js"

class CovariancePage {

    // Hovering tooltip for both phylogram and covariance plot
    guid = undefined;
    parsed_bipartition_taxa = undefined;
    cov_mouse_active_x = null;
    cov_mouse_active_y = null;
    active_link = null;
    phylogram_mouseover_active = false;
    cd_groups = undefined;
    covariance_plot = null;
    phylogram_plot = null;

    constructor() {}

    /*
     * Draw hover-over tooltip for bipartitions on both the phylogram and covariance network
     */
    static draw_tooltip(tooltip) {
        let x_tooltip_width_abs = 100;
        let y_tooltip_width_abs = 18;

        let x_tooltip_mag = (tooltip.x < x_tooltip_width_abs) ? -1 : 1;
        let y_tooltip_mag = (tooltip.y < y_tooltip_width_abs) ? -1 : 1;

        let x_tooltip_width = x_tooltip_mag * x_tooltip_width_abs;
        let y_tooltip_width = y_tooltip_mag * y_tooltip_width_abs;

        tooltip.ctx.beginPath();
        tooltip.ctx.globalAlpha = 1.0;
        tooltip.ctx.fillStyle = "black";

        // This should be adjusted to scale.
        tooltip.ctx.font = '18px serif';
        let x_text_loc = (x_tooltip_mag == 1) ? tooltip.x - x_tooltip_width + 5 : tooltip.x + 5;
        let y_text_loc = (y_tooltip_mag == 1) ? tooltip.y - 5 : tooltip.y  - y_tooltip_width + 5;
        tooltip.ctx.fillText(tooltip.text, x_text_loc, y_text_loc);
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

    static parse_cd(groups) {
        let d = {};
        Object.keys(groups).forEach(k => {
            let group = groups[k];
            let node = k;
            let color = null;
            if (group >= css_colors.length) {
                color = 'grey'
            } else {
                color = css_colors[group];
            }
            d[node] = { group: group, color: color };
        });
        return d;
    }

    build_controls(phylogram_plot, covariance_plot) {
        let pcc = document.getElementById('plot-controls');
        pcc.append(document.createElement('hr'));
        let help = document.createElement('h4');
        help.textContent = 'Help:';
        let help_list = document.createElement('ul');
        let help_items = [
            'Mouse-over bipartitions in either plot to see their corresponding representation in the opposing plot.',
            'Click a bipartition will select it.',
            'Click bipartitions while holding shift to select multiple.',
            'Mouse-scroll over the covariance network to resize.',
            'Drag covariance nodes to re-arrange the network.'
        ];

        for (const i of help_items) {
            let help_item = document.createElement('li');
            help_item.textContent = i;
            help_list.append(help_item);
        }

        pcc.append(help, help_list);

        pcc.append(document.createElement('hr'));

        pcc.append(htmlToElement(`<div class="field has-addons">
        <div class="control">
            <button id="publish-graph" class="button is-info">Publish Graph</button>
        </div>`));

        // Downloads a PNG displaying both phylogram and covariance network side-by-side as they are shown.
        document.getElementById("publish-graph").addEventListener("click", () => {
            let covariance_canvas = document.getElementById('covariance-canvas');
            let tree_canvas = document.getElementById('tree-canvas');

            let combined_width = covariance_canvas.width + tree_canvas.width;
            let combined_height = Math.max(covariance_canvas.height,tree_canvas.height);

            var Parser = new DOMParser();

            let phylo_svg_serialized = phylogram_plot.dummy_ctx.getSerializedSvg(true);
            let phylogram_svg = Parser.parseFromString(phylo_svg_serialized, "image/svg+xml").documentElement;

            let cov_svg_serialized = covariance_plot.dummy_ctx.getSerializedSvg(true);
            let covariance_svg = Parser.parseFromString(cov_svg_serialized, "image/svg+xml").documentElement;

            let combo_svg = document.createElement('svg');
            combo_svg.append(phylogram_svg);
            combo_svg.append(covariance_svg);

            // Note
            // To save directly from canvas2svg object:
            //     let dataUrl = 'data:image/svg+xml,'+encodeURIComponent(phylo_svg_serialized);

            // DEV base64 encode
            let svg_blob = new Blob([combo_svg.outerHTML], {type:"image/svg+xml;charset=utf-8"});
            let dataUrl = URL.createObjectURL(svg_blob);
            let download_link = document.createElement('a')
            download_link.href = dataUrl;
            download_link.download = 'phylogram_plot.svg';
            download_link.click();
        });

        let info_pane = document.createElement('div');
        info_pane.setAttribute('id', 'covariance_info_pane');

        let bipartition_list = document.createElement('span');
        bipartition_list.setAttribute('id', 'bipartition-list');
        bipartition_list.textContent = "Bipartitions selected: "

        info_pane.append(bipartition_list);
        pcc.append(info_pane);
    }


    static determine_default_files(files) {

        // DEV test no match
        let covariance_matrix_regex = /Covariance Matrix/i
        let covariance_matrix_file_obj = files.filter(obj => covariance_matrix_regex.test(obj.name))[0];

        if (covariance_matrix_file_obj == undefined) {
            return undefined;
        }

        // History item name for the covariance matrix file
        let history_item_string = covariance_matrix_file_obj.name.match(/data [0-9]+$/)[0];

        // Number of the history item used as input for the Covariance Matrix file
        let history_number = parseInt(history_item_string.match(/[0-9]+/));

        // Find Bipartition Matrix file generated from the same history item
        let bip_matrix_regex = new RegExp(`Bipartition Matrix.*${history_item_string}$`);
        let bip_matrix_file_obj = files.filter(obj => bip_matrix_regex.test(obj.name))[0];

        // Find Bipartition Counts file generated from the same history item
        let bip_counts_regex = new RegExp(`Bipartition Counts.*${history_item_string}$`);
        let bip_counts_file_obj= files.filter(obj => bip_counts_regex.test(obj.name))[0];

        // Find Taxa IDs  file generated from the same history item
        let taxa_ids_regex = new RegExp(`Taxa IDs.*${history_item_string}$`);
        let taxa_ids_file_obj = files.filter(obj => taxa_ids_regex.test(obj.name))[0];

        // Find the original input history item used to generate the above files
        let trees_file_obj = files.filter(obj => obj.hid == history_number)[0];

        return {
            'covariance_matrix': covariance_matrix_file_obj,
            'bipartition_matrix': bip_matrix_file_obj,
            'bipartition_counts': bip_counts_file_obj,
            'taxa_ids': taxa_ids_file_obj,
            'tree_file': trees_file_obj
        }
    }

    request_file_contents(files, guid) {
        dispatchEvent(build_event("FileContentsRequest", {
            guid: guid,
            files: Object.keys(files).map(k => files[k])
        }));
    }

    build_mouseover_action(phylogram_plot, covariance_plot) {

        let redraw_info_pane = function() {
            let bipartition_list = document.getElementById('bipartition-list');
            let bipartition_list_text = "Bipartitions selected:";
            for (const b of covariance_plot.selected_bipartitions) {
                bipartition_list_text += ' '
                bipartition_list_text += b;
                bipartition_list_text += ','
            }
            bipartition_list.textContent = bipartition_list_text.slice(0, -1);
        }


        // Called when user moves their mouse over the canvas. This allows for the inspecting and selecting
        // of specific bipartitions in the network.
        // DEV Commented out at this stage of development
        covariance_plot.canvas.addEventListener("mousemove", function(e) {

            // Get coordinates of the canvas element in the browser page.
            let canvas_rect = covariance_plot.canvas.getBoundingClientRect();

            // This represents the X and Y in relation to the canvas element.
            let x = e.clientX - canvas_rect.left, y = e.clientY - canvas_rect.top;

            if (this.cov_mouse_active_x != null) {
                let dist_traveled = Math.sqrt(Math.pow(x - this.cov_mouse_active_x, 2) + Math.pow(y - this.cov_mouse_active_y, 2));
                if (dist_traveled < CovariancePlot.highlight_cov_node_r) {
                    // Current mouseover is still active.
                    return;
                }

                this.cov_mouse_active_x = null;
                this.cov_mouse_active_y = null;
            }

            // Will be set to a bipartition that is found to be under the user's mouse.
            let found_bipartition = null;

            let ctx = covariance_plot.canvas.getContext('2d');

            // Iterate through each node.
            for (const d of covariance_plot.graph_data.nodes) {

                // Find distance between user's mouse and center of the node.
                let dist = Math.sqrt(Math.pow(x - d.x, 2) + Math.pow(y - d.y, 2));

                // If that distance is less than the node radius, the user's mouse is found to be within the node drawing,
                // Use the slightly larger highlighted radius for an extra margin in which the node becomes highlighted.
                if (dist < CovariancePlot.highlight_cov_node_r) {

                    this.cov_mouse_active_x = d.x;
                    this.cov_mouse_active_y = d.y;

                    // Note the bipartition we found under the mouse and break.
                    found_bipartition = d.id;
                    break;
                }
            }

            // If we found a bipartition under the mouse, set the covariance_plot.current_bipartition, redraw both phylogram and covariance network, and the tooltip.
            if (found_bipartition !== null) {
                if (covariance_plot.current_bipartition !== found_bipartition) {
                    covariance_plot.current_bipartition = found_bipartition;
                    phylogram_plot.current_bipartition = found_bipartition;
                }
                covariance_plot.update();
                phylogram_plot.update();
                CovariancePage.draw_tooltip({
                    ctx: ctx,
                    x: x,
                    y: y,
                    text: `Bipartition ${found_bipartition}`
                });

            // If we found nothing, and there was in the previous mouseover event a bipartition under the mouse (the mouse is moving out of a node),
            // clear tooltip, current link and bipartition, and redraw visualization.
            } else {
                if (covariance_plot.current_bipartition !== null) {
                    phylogram_plot.current_bipartition = null;
                    covariance_plot.current_bipartition = null;
                    covariance_plot.update();
                    phylogram_plot.update();
                }
            }
        }.bind(this));

        // When a bipartition node is clicked, its added to the list of selected bipartitions and both it and its corresponding bipartition in phylogram (if it
        // exists) are highlighted until another node is selected. Holding shift allows for the selection, and deselecting, of multiple nodes.
        covariance_plot.canvas.addEventListener("click", function(e) {
            if (covariance_plot.current_bipartition != null) {
                if (!covariance_plot.selected_bipartitions.includes(covariance_plot.current_bipartition)){
                    covariance_plot.add_current_bipartition(e.shiftKey);
                    phylogram_plot.add_current_bipartition(e.shiftKey);
                } else {
                    covariance_plot.remove_current_bipartition();
                    phylogram_plot.remove_current_bipartition();
                }
            redraw_info_pane();
            }
        }.bind(this));

        let check_if_over_link = function (ctx, x, y, tree_link) {

            let source = tree_link.scaled_coord.source;
            let target = tree_link.scaled_coord.target;
            let on_link = false;

            phylogram_plot.create_empty_line(ctx, source.x, source.y, source.x, target.y);

            if (ctx.isPointInStroke(x, y) && tree_link.link.target.children !== undefined) {
                on_link = true;
            }

            phylogram_plot.create_empty_line(ctx, source.x, target.y, target.x, target.y);

            if (ctx.isPointInStroke(x, y) && tree_link.link.target.children !== undefined) {
                on_link = true;
            }

            return on_link;
        }

        phylogram_plot.canvas.addEventListener("mousemove", function(e) {
            let event_date = Date.now()
            let canvas_rect = phylogram_plot.canvas.getBoundingClientRect();
            let x = e.clientX - canvas_rect.left, y = e.clientY - canvas_rect.top;
            let found_link = null;
            let ctx = phylogram_plot.canvas.getContext('2d');

            if (this.active_link != null) {
                if (check_if_over_link(ctx, x, y, this.active_link)) {
                    // Current mouseover is still active.
                    return;
                }

                this.active_link = null;
            }

            for (const t of phylogram_plot.tree_links) {
                let on_link = check_if_over_link(ctx, x, y, t);

                if (on_link) {
                    found_link = t;
                    break;
                }
            }

            if (found_link !== null) {

                this.active_link = found_link;

                // DEV Is this necessary anymore?
                phylogram_plot.current_bipartition = found_link.bipartition_id;
                covariance_plot.current_bipartition = found_link.bipartition_id;

                // DEV why this instead of draw()?
                covariance_plot.update();
                phylogram_plot.update();
                if (covariance_plot.current_bipartition !== null) {
                    CovariancePage.draw_tooltip({
                        ctx: ctx,
                        x: x,
                        y: y,
                        text: `Bipartition ${covariance_plot.current_bipartition}`
                    });
                }
            } else {
                if (phylogram_plot.current_bipartition !== null) {
                    phylogram_plot.current_bipartition = null;
                    covariance_plot.current_bipartition = null;
                    // DEV why this instead of draw()?
                    covariance_plot.update();
                    phylogram_plot.update();
                }
            }
        }.bind(this));

        // This function is similar to the mousemove event for the covariance network in this same file.
        phylogram_plot.canvas.addEventListener("click", function(e) {
            if (phylogram_plot.current_bipartition != null) {
                if (!phylogram_plot.selected_bipartitions.includes(phylogram_plot.current_bipartition)){
                    phylogram_plot.add_current_bipartition(e.shiftKey);
                    if (covariance_plot.current_bipartition != null) {
                        covariance_plot.add_current_bipartition(e.shiftKey);
                    }
                } else {
                    phylogram_plot.remove_current_bipartition();
                    if (covariance_plot.current_bipartition != null) {
                        covariance_plot.remove_current_bipartition();
                    }
                }
            redraw_info_pane();
            }
        }.bind(this));
    }

    handle_file_contents_event(e) {
        if (e.detail.guid === this.guid) {

            let plot_element = document.getElementById('plot');
            while (plot_element.firstChild) {
                plot_element.removeChild(plot_element.firstChild);
            }

            // DEV remove htmlToElement
            plot_element.append(htmlToElement(`<div id="tree-plot" style="vertical-align: top; width: 50%; margin: 0px; padding-right: 0px; font-size:0; border: 0px; display:inline-block; overflow: visible"/>`));

            // DEV remove htmlToElement
            plot_element.append(htmlToElement(`<div id="cov-plot" style="width: 50%; margin: 0px; padding-left: 0px; border: 0px; font-size:0; display:inline-block; overflow: visible"/>`));

            this.covariance_plot = new CovariancePlot('cov-plot', 'plot-controls', 'plot-metadata', this.cd_groups);
            this.phylogram_plot = new PhylogramPlot('tree-plot', 'plot-controls', 'plot-metadata');

            // Parse files
            e.detail.contents.forEach(file => {
                if (/^Covariance Matrix/.test(file.fileName)) {
                    let arr = file.data.split('\n');
                    this.covariance_plot.parse_covariance(CovariancePage.clean_data(file.data));
                }

                if (/^Bipartition Matrix/.test(file.fileName)) {
                    this.covariance_plot.parse_bipartition_cov(CovariancePage.clean_data(file.data));
                }

                if (/^Taxa IDs/.test(file.fileName)) {
                    this.covariance_plot.parse_taxa_array(file.data);
                }

                if (/cloudforest.trees/.test(file.fileExt)) {
                     this.phylogram_plot.parse_boottree_data(file.data);
                }
            });

            // Bipartition Counts must be parsed after the Taxa IDs
            e.detail.contents.forEach(file => {
                if (/^Bipartition Counts/.test(file.fileName)) {
                    this.parsed_bipartition_taxa = this.covariance_plot.parse_taxa_partitions(CovariancePage.clean_data(file.data));
                }
            });

            // Clear existing plot control and metadata and rebuild
            removeChildNodes("plot-controls");
            removeChildNodes("plot-metadata");

            this.phylogram_plot.parsed_bipartition_taxa = this.parsed_bipartition_taxa;
            this.phylogram_plot.taxa_array = this.covariance_plot.taxa_array;

            // Create complementary representation of bipartitions
            this.phylogram_plot.unique_taxa_complements = {};
            for (const [k, bipartition_set] of Object.entries(this.parsed_bipartition_taxa)) {
                let complement = this.phylogram_plot.taxa_array.filter(t => !bipartition_set.includes(t));
                let complement_set = new Set(complement);
                this.phylogram_plot.unique_taxa_complements[k] = complement;
            }

            this.phylogram_plot.build_trees();
            this.phylogram_plot.draw();
            this.covariance_plot.draw();

            // DEV don't pass
            this.build_controls(this.phylogram_plot, this.covariance_plot);
            this.phylogram_plot.build_controls();
            this.covariance_plot.build_controls();

            // DEV don't pass
            this.build_mouseover_action(this.phylogram_plot, this.covariance_plot);
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

        // Event that parses file contents
        addEventListener("FileContents", this.handle_file_contents_event.bind(this));

        // Event for initial plot request
        addEventListener("CovariancePageRequest", e => {
            this.request_file_contents(e.detail.file_ids, this.guid);
        });

        //User has requested that CD groups be used in plotting.
        addEventListener("CDByBipartition", (e => {
            if (this.covariance_plot !== null) {
                this.covariance_plot.cd_groups = CovariancePage.parse_cd(e.detail.groups);
                this.cd_groups = this.covariance_plot.cd_groups;
            } else {
                this.cd_groups = CovariancePage.parse_cd(e.detail.groups);
            }
        }).bind(this));
        //User has requested that CD groups _not_ be used in plotting.
        addEventListener("RemoveCDPlotting", (e => {
            if (this.covariance_plot !== null) {
                this.covariance_plot.cd_groups = undefined;
            }
            this.cd_groups = undefined;
        }).bind(this));
    }
}

export { CovariancePage }

// DEV
//// The phylogram link and covariance bipartition being highlighted due one or the other,
//// and its associated member in the other plot.
//let phylogram_plot.current_bipartition = null;
//let covariance_plot.current_bipartition = null;
//
//// All links and bipartitions selected for highlighting.
//let phylogram_plot.selected_bipartitions = [];
//let covariance_plot.selected_bipartitions = [];

// List where each entry is a list of taxa representing the bipartition corresponding with that index.
//let parsed_bipartition_taxa = undefined;

/**
 * Parses out communities and assigns corresponding colors
 *
 * @param {[]} groups Group data
 */
// DEV


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
//     return (b == covariance_plot.current_bipartition || covariance_plot.selected_bipartitions.includes(b));
// }
