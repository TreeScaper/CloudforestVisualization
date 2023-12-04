import { htmlToElement } from "../utilities/html_templates";
import { get_file_contents, get_input_hcontent, get_hcontent_with_input } from "../data_manager";
import { clear_plot } from "../utilities/support_funcs";
import { PhylogramPlot } from "../components/phylogram_plot.js"
import { CovariancePlot } from "../components/covariance_plot.js"
import * as constants from "../utilities/constants";

// Hovering tooltip for both phylogram and covariance plot
let cov_mouse_active_x = null;
let cov_mouse_active_y = null;
let active_link = null;
let cd_groups = undefined;
let covariance_plot = null;
let phylogram_plot = null;

/*
 * Draw hover-over tooltip for bipartitions on both the phylogram and covariance network
 */
const draw_tooltip = function(tooltip) {
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

const parse_cd = function(groups) {
    let d = {};
    Object.keys(groups).forEach(k => {
        let group = groups[k];
        let node = k;
        let color = null;
        if (group >= constants.cd_colors.length) {
            color = 'grey'
        } else {
            color = constants.cd_colors[group];
        }
        d[node] = { group: group, color: color };
    });
    return d;
}

const build_controls = function() {
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


const determine_default_cov_files = function(files) {

    // Find the covariance matrix history item.
    let covariance_hcontent = files.filter(obj => obj.extension === 'cloudforest.covariance')[0];
    if (covariance_hcontent === undefined) {
        return undefined;
    }

    // Get input trees history content item
    let trees_hcontent = get_input_hcontent(covariance_hcontent, files);

    // Get bipartition outputs from given trees file.
    let bip_matrix_hcontent = get_hcontent_with_input(trees_hcontent.id, files).filter(c => c.extension === 'cloudforest.bipartition')[0];
    let bip_counts_hcontent = get_hcontent_with_input(trees_hcontent.id, files).filter(c => c.extension === 'cloudforest.counts')[0];
    let taxa_ids_hcontent = get_hcontent_with_input(trees_hcontent.id, files).filter(c => c.extension === 'cloudforest.taxids')[0];

    return {
        'covariance_matrix': covariance_hcontent,
        'bipartition_matrix': bip_matrix_hcontent,
        'bipartition_counts': bip_counts_hcontent,
        'taxa_ids': taxa_ids_hcontent,
        'tree_file': trees_hcontent
    }
}

const build_mouseover_action = function() {

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

        if (cov_mouse_active_x != null) {
            let dist_traveled = Math.sqrt(Math.pow(x - cov_mouse_active_x, 2) + Math.pow(y - cov_mouse_active_y, 2));
            if (dist_traveled < CovariancePlot.highlight_cov_node_r) {
                // Current mouseover is still active.
                return;
            }

            cov_mouse_active_x = null;
            cov_mouse_active_y = null;
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

                cov_mouse_active_x = d.x;
                cov_mouse_active_y = d.y;

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
            draw_tooltip({
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
    });

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
    });

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

        if (active_link != null) {
            if (check_if_over_link(ctx, x, y, active_link)) {
                // Current mouseover is still active.
                return;
            }

            active_link = null;
        }

        for (const t of phylogram_plot.tree_links) {
            let on_link = check_if_over_link(ctx, x, y, t);

            if (on_link) {
                found_link = t;
                break;
            }
        }

        if (found_link !== null) {

            active_link = found_link;

            // DEV Is this necessary anymore?
            phylogram_plot.current_bipartition = found_link.bipartition_id;
            covariance_plot.current_bipartition = found_link.bipartition_id;

            // DEV why this instead of draw()?
            covariance_plot.update();
            phylogram_plot.update();
            if (covariance_plot.current_bipartition !== null) {
                draw_tooltip({
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
    });

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
    });
}

const file_contents_callback = function(contents) {
    clear_plot();

    let plot_element = document.getElementById(constants.plot_id);

    // DEV remove htmlToElement
    plot_element.append(htmlToElement(`<div id="tree-plot" style="vertical-align: top; width: 50%; margin: 0px; padding-right: 0px; font-size:0; border: 0px; display:inline-block; overflow: visible"/>`));

    // DEV remove htmlToElement
    plot_element.append(htmlToElement(`<div id="cov-plot" style="width: 50%; margin: 0px; padding-left: 0px; border: 0px; font-size:0; display:inline-block; overflow: visible"/>`));

    let covariance_data = undefined;
    let bipartition_data = undefined;
    let taxa_array_data = undefined;
    let boottree_data = undefined;

    let data_objects = [
        { name: 'covariance_data',    regex: /cloudforest.covariance/, data: undefined, plot: 'covariance' },
        { name: 'bipartition_matrix', regex: /cloudforest.bipartition/, data: undefined, plot: 'covariance' },
        { name: 'taxa_ids',           regex: /cloudforest.taxids/, data: undefined, plot: 'covariance' },
        { name: 'boottree_data',      regex: /cloudforest.trees/, data: undefined, plot: 'phylogram' },
        { name: 'bipartition_taxa',   regex: /cloudforest.counts/, data: undefined, plot: 'covariance' }
    ];

    let covariance_file_data = {};
    let phylogram_file_data = {};

    // Parse files
    contents.forEach(file => {
        data_objects.forEach(o => {
            if (o.regex.test(file.fileExt)) {
                if (o.plot == 'covariance') {
                    covariance_file_data[o.name] = file.data;
                } else {
                    phylogram_file_data[o.name] = file.data;
                }
            }
        });
    });

    covariance_plot = new CovariancePlot(covariance_file_data, cd_groups);

    // Phylogram Plot can use this covariance matrix data
    phylogram_file_data.bipartition_taxa = covariance_plot.bipartition_taxa;
    phylogram_file_data.taxa_array = covariance_plot.taxa_array;

    phylogram_plot = new PhylogramPlot(phylogram_file_data);

    build_controls();
    build_mouseover_action();
}


/**
 * Initializes module for mapping covariance plot to phylogram
 */
const covariance_page_init = function() {

    // Event for initial plot request
    addEventListener("CovariancePageRequest", e => {
        get_file_contents(Object.keys(e.detail.file_ids).map(k => e.detail.file_ids[k]), file_contents_callback);
    });

    //User has requested that CD groups be used in plotting.
    addEventListener("CDByBipartition", (e => {
        if (covariance_plot !== null) {
            covariance_plot.cd_groups = parse_cd(e.detail.groups);
            cd_groups = covariance_plot.cd_groups;
        } else {
            cd_groups = parse_cd(e.detail.groups);
        }
    }));

    //User has requested that CD groups _not_ be used in plotting.
    addEventListener("RemoveCDPlotting", (e => {
        if (covariance_plot !== null) {
            covariance_plot.cd_groups = undefined;
        }
        cd_groups = undefined;
    }));
}

export { covariance_page_init, determine_default_cov_files }

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