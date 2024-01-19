import { removeChildNodes, htmlToElement } from "../utilities/html_templates";
import { newick_parse, nexus_parse, length_schemes } from "./tree_data_parsing.js"
import { set_background, set_equality } from "../utilities/support_funcs";
import * as constants from "../utilities/constants";

class PhylogramPlot {

    static slider_element_id = 'boottree-slider';
    static tree_num_element_id = 'boottree-number';
    static canvas_plot_element_id = 'tree-canvas';
    static plot_element_id = 'tree-plot';
    static default_link_style = 'rgba(128, 128, 128, 1)' // Default color for lines in phylogram.;
    static tree_node_r = 5; // Radius for tree nodes

    boottree_data = {};
    canvas = undefined;
    scale_x = undefined;
    scale_y = undefined;
    length_scheme = 'raw';
    trees = {}
    normalized = false;

    // Links in phylogram
    tree_links = [];

    // DEV Should these be moved back to covariance_page.js?
    selected_bipartitions = [];

    // Phylogram root
    tree_root = undefined;

    constructor(file_data, tree_number = 1) {

        this.tree_number = tree_number;

        this.plot = document.getElementById(PhylogramPlot.plot_element_id);

        // Get width of the plot element for phylogram
        let doc_width = this.plot.clientWidth;

        // Create a square canvas with fractional width and height
        let width = doc_width;
        //let width = Math.floor((doc_width - (.02 * doc_width)) / 100) * 100;
        //let width = Math.floor((doc_width - (.15 * doc_width)) / 100) * 100;
        let height = width;

        // Create new canvas
        this.canvas = document.createElement('canvas');

        // Set canvas attributes
        this.canvas.setAttribute('id', PhylogramPlot.canvas_plot_element_id)
        this.canvas.setAttribute("width", width);
        this.canvas.setAttribute("height", height);

        // Create dummy canvas context
        let C2S = require('canvas2svg');
        this.dummy_ctx = C2S(width, height);

        this.parse_boottree_data(file_data.boottree_data)
        this.bipartition_taxa = file_data.bipartition_taxa;
        this.taxa_array = file_data.taxa_array;

        if (this.bipartition_taxa !== undefined) {
            // Create complementary representation of bipartitions
            this.unique_taxa_complements = {};
            for (const [k, bipartition_set] of Object.entries(this.bipartition_taxa)) {
                let complement = this.taxa_array.filter(t => !bipartition_set.includes(t));
                let complement_set = new Set(complement);
                this.unique_taxa_complements[k] = complement;
            }
        }

        this.build_trees();
        this.build_controls();
        this.draw();
    }

    parse_boottree_data(d) {
        if (d.substring(0,6) === '#NEXUS') {
            this.boottree_data.raw = nexus_parse(d, 'raw');
            this.boottree_data.normalized = nexus_parse(d, 'normalized');
            this.boottree_data.normalized_rtt = nexus_parse(d, 'normalized_rtt');
        } else {
            this.boottree_data.raw = d.split(';').map(l => newick_parse(l));
            this.boottree_data.normalized = d.split(';').map(l => newick_parse(l, 'normalized'))
            this.boottree_data.normalized_rtt = d.split(';').map(l => newick_parse(l, 'normalized_rtt'))

            // wagnerr: will there always be a terminating semi-colon?
            if (this.boottree_data.raw[this.boottree_data.raw.length-1].length === undefined) {
                this.boottree_data.raw.pop();
                this.boottree_data.normalized.pop();
                this.boottree_data.normalized_rtt.pop();
            }
        }
    }

    find_next_tree() {
        if (this.selected_bipartitions.length == 0) {
            return;
        }
        //console.log(this.bipartition_map);
        for (let tree_index = this.tree_number; tree_index != this.tree_number - 1; tree_index++) {

            // Wrap to beginning of tree array
            tree_index = tree_index % this.boottree_data.raw.length;

            //tree_index = (tree_index + this.tree_number + 1) % this.boottree_data.length;
            let has_all_bipartitions = true;
            for (const b of this.selected_bipartitions) {
                //console.log(tree_index, this.bipartition_map[tree_index].includes(b));
                if (!this.bipartition_map[tree_index].includes(b)) {
                    has_all_bipartitions = false;
                    break;
                }
            }
            if (has_all_bipartitions) {
                this.tree_number = tree_index + 1;
                document.getElementById(PhylogramPlot.tree_num_element_id).value = this.tree_number;
                document.getElementById(PhylogramPlot.slider_element_id).value = this.tree_number;
                this.draw();
                return;
            }
        }
    }

    build_controls() {
        let tree_controls_div = document.createElement('div');
        tree_controls_div.setAttribute('id', 'tree-controls');

        // Create slider for selecting tree to display.
        let slider_input = document.createElement('input');
        slider_input.setAttribute('type', 'range');
        slider_input.setAttribute('id', PhylogramPlot.slider_element_id);
        slider_input.setAttribute('min', 1);
        slider_input.setAttribute('max', this.boottree_data.raw.length);
        slider_input.setAttribute('value', 1);
        slider_input.setAttribute('size', 4);
        slider_input.setAttribute('step', 1);
        slider_input.setAttribute('name', 'boottree');

        // Create corresponding number input.
        let tree_number_input = document.createElement('input');
        tree_number_input.setAttribute('type', 'number');
        tree_number_input.setAttribute('id', PhylogramPlot.tree_num_element_id);
        tree_number_input.setAttribute('min', 1);
        tree_number_input.setAttribute('max', this.boottree_data.raw.length);
        tree_number_input.setAttribute('value', this.tree_number);
        tree_number_input.setAttribute('size', 4);

        // <label for="${PhylogramPlot.slider_element_id}">Tree Number: <span id="${PhylogramPlot.tree_number_element_id}">1</span></label>
        let label = document.createElement('label');
        label.setAttribute('for', PhylogramPlot.tree_num_element_id);
        label.textContent = 'Tree number:';

        let space_buffer = document.createTextNode('\u00A0\u00A0');

        let control_div = document.createElement('div');
        control_div.setAttribute('class', 'control');
        control_div.append(label, tree_number_input, space_buffer, slider_input);

        let field_div = document.createElement('div');
        field_div.setAttribute('class', 'field');
        field_div.append(control_div);

        tree_controls_div.append(field_div);

        // Add event handler for the tree number slide. Redraw the tree with draw_tree() each time it changes.
        slider_input.addEventListener("input", () => {
            this.tree_number = Number(document.getElementById(PhylogramPlot.slider_element_id).value);
            document.getElementById(PhylogramPlot.tree_num_element_id).value = this.tree_number;

            this.draw();
        });

        tree_number_input.addEventListener("input", () => {
            this.tree_number = Number(document.getElementById(PhylogramPlot.tree_num_element_id).value);
            document.getElementById(PhylogramPlot.slider_element_id).value = this.tree_number;

            this.draw();
        });

        let branch_length_select = document.createElement('div');
        branch_length_select.setAttribute('class', 'select');

        let length_select = document.createElement('select');
        length_select.setAttribute('class', 'is-small');
        length_select.setAttribute('id', 'length-select');

        for (const s of length_schemes) {
            let option = document.createElement('option');
            option.setAttribute('class', 'file-list-option');
            option.setAttribute('scheme_name', s.name);
            option.textContent = s.description;
            length_select.append(option);
        }

        length_select.addEventListener("input", (e) => {
            this.length_scheme = e.currentTarget.options[e.currentTarget.selectedIndex].getAttribute('scheme_name');
            this.draw();
        });

        branch_length_select.append(length_select);

        let label_text = document.createTextNode('Branch length scheme');
        branch_length_select.append(label_text);

        tree_controls_div.append(branch_length_select);

        // Add button to find next tree with selected bipartitions.
        let next_tree_field_div = document.createElement('div');
        next_tree_field_div.setAttribute('class', 'field has-addons');

        let next_tree_control_div = document.createElement('div');
        next_tree_control_div.setAttribute('class', 'control');
        next_tree_field_div.append(next_tree_control_div);

        let next_tree_button = document.createElement('button');
        next_tree_button.setAttribute('id', 'next-tree');
        next_tree_button.setAttribute('class', 'button is-info');
        next_tree_button.textContent = 'Next tree with selected bipartitions';
        next_tree_button.addEventListener("click", () => {
            this.find_next_tree();
        });
        next_tree_field_div.append(next_tree_button);

        tree_controls_div.append(next_tree_field_div);

        // Add phylogram controls to controls div
        let pcc = document.getElementById(constants.plot_controls_id);
        pcc.append(tree_controls_div);
    }

    //update_tree_list() {

    //}

    add_current_bipartition(shift_selected) {
        if (shift_selected) {
            this.selected_bipartitions.push(this.current_bipartition);
        } else {
            this.selected_bipartitions = [this.current_bipartition];
        }
        //update_tree_list();
    }

    remove_current_bipartition() {
        this.selected_bipartitions = this.selected_bipartitions.filter(b => b != this.current_bipartition);
        //update_tree_list();
    }

    create_bipartition_map(tree_links) {
        if (this.bipartition_taxa === undefined) {
            return;
        }

        this.bipartition_map.push([]);


        // Iterate through links in the phylogram
        for (const t of tree_links) {

            // Not considered a bipartition if there is one leaf.
            if (t.link.target.children === undefined) {
                continue;
            }

            // For each phylogram link, representing a bipartition, find the associated taxa.
            let leaf_names = [];
            for (const leaf of t.link.target.leaves()) {
                leaf_names.push(leaf.data.name);
            }
            let leaves_set = new Set(leaf_names);

            let match_found = false;

            for (const [k, bipartition] of Object.entries(this.bipartition_taxa)) {
                let bipartition_set = new Set(bipartition);

                // If the taxa both from the covariance network bipartition (node), and the phylogram bipartition (link) are equal
                // they are the same bipartition. Select the found link as the phylogram_plot.current_link, which means it will be highlighted.
                if (set_equality(leaves_set, bipartition_set)) {
                    t.bipartition_id = k;
                    this.bipartition_map[this.bipartition_map.length - 1].push(k);
                    match_found = true;

                    //delete this.bipartition_taxa[k];
                    break;
                }
            }

            // Check complements
            if (!match_found) {

                for (const [k, bipartition_complement] of Object.entries(this.unique_taxa_complements)) {
                    let bipartition_set_complement = new Set(bipartition_complement);

                    // If the taxa both from the covariance network bipartition (node), and the phylogram bipartition (link) are equal
                    // they are the same bipartition. Select the found link as the phylogram_plot.current_link, which means it will be highlighted.
                    if (set_equality(leaves_set, bipartition_set_complement)) {
                        t.bipartition_id = k;
                        this.bipartition_map[this.bipartition_map.length - 1].push(k);

                        //delete this.bipartition_taxa[k];
                        break;
                    }
                }
            }
        }
    }

    /**
     * Redraws phylogram on existing tree-canvas element.
     */
    update() {
        let ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        set_background(ctx, this.canvas.width, this.canvas.height);

        this.dummy_ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        set_background(this.dummy_ctx, this.canvas.width, this.canvas.height);

        let get_latest_color = function(table, i) {
            if (i >= constants.bipartition_color_table.length) {
                return constants.bipartition_color_table[constants.bipartition_color_table.length - 1];
            } else {
                return constants.bipartition_color_table[i];
            }
        }.bind(this);

        this.tree_links.forEach(t => {
            if (t.bipartition_id !== undefined && t.bipartition_id == this.current_bipartition || this.selected_bipartitions.includes(t.bipartition_id)) {
                let highlight_link_style = undefined;

                let max_index = constants.bipartition_color_table.length - 1;
                let selected_bipartition_index = this.selected_bipartitions.indexOf(t.bipartition_id);
                if (selected_bipartition_index != -1) {
                    highlight_link_style = constants.bipartition_color_table[Math.min(selected_bipartition_index, max_index)];
                } else {
                    highlight_link_style = constants.bipartition_color_table[Math.min(this.selected_bipartitions.length, max_index)];
                }

                this.draw_tree_link(ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.target.x, t.scaled_coord.target.y, highlight_link_style, 4, 2);
                this.draw_tree_link(this.dummy_ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.target.x, t.scaled_coord.target.y, highlight_link_style, 4, 2);

            } else {
                this.draw_tree_link(ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.target.x, t.scaled_coord.target.y);
                this.draw_tree_link(this.dummy_ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.target.x, t.scaled_coord.target.y);
            }
        });

        // Leaves are drawn blue.
        this.tree_root.leaves().forEach(leaf => {
            this.draw_node(ctx, leaf, true);
            this.draw_node(this.dummy_ctx, leaf, true);
        });
    }


    build_links(tree_data) {
        // Get scaling values for drawing phylogram
        let [scale_x, scale_y, tree_root] = PhylogramPlot.get_root(tree_data, this.canvas.height, this.canvas.width);

        // Draw links
        let tree_links = [];
        tree_root.links().forEach(link => {
            let scaled_link = {
                "source": {
                    "x": scale_x(link.source.x),
                    "y": scale_y(link.source.y)
                },
                "target": {
                    "x": scale_x(link.target.x),
                    "y": scale_y(link.target.y)
                }
            }
            tree_links.push({'link': link, 'scaled_coord': scaled_link});
        });
        this.create_bipartition_map(tree_links);

        return {tree_links, tree_root, scale_x, scale_y};
    }

    build_trees() {
        this.bipartition_map = [];
        // for tree_number in numbers
        for (const s of length_schemes) {
            this.trees[s.name] = [];
            for (let tree_number = 0; tree_number < this.boottree_data.raw.length; tree_number++) {
                let tree_data = this.boottree_data[s.name][tree_number];
                let link_data = this.build_links(tree_data);
                this.trees[s.name].push(link_data);
            }
        }
    }

    /*
     * Create a fresh phylogram visualization. There is some redundancy between this and create_tree() in phylogram.js.
     */
    draw() {
        // Remove child-nodes of cov-plot and recreate canvas as child
        removeChildNodes(PhylogramPlot.plot_element_id);

        // Get data for current tree
        let tree_data = null;
        tree_data = this.boottree_data[this.length_scheme][this.tree_number - 1];

        // Create title with tree number
        if (this.tree_number) {
            this.plot.append(htmlToElement(`<div><h3>Tree ${this.tree_number}</h3></div>`));
        }

        // Add canvas to document
        this.plot.append(this.canvas);

        // Get canvas context and fill entirely white
        let ctx = this.canvas.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.lineWidth = 1.5;

        // Dummy context is used for downloading SVG plots. Eventually will be consolidated.
        this.dummy_ctx.fillStyle = "white";
        this.dummy_ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.dummy_ctx.lineWidth = 1.5;

        // Draw links
        //let link_data = build_links(tree_data);
        let link_data = this.trees[this.length_scheme][this.tree_number - 1];
        this.tree_root = link_data.tree_root;
        this.tree_links = link_data.tree_links;
        this.scale_x = link_data.scale_x;
        this.scale_y = link_data.scale_y;


        this.update();

        return this.canvas;
    }

    // DEV document
    draw_node(ctx, node, is_leaf=false) {
        if (is_leaf) {
            ctx.fillStyle = "blue";
            ctx.beginPath();
            ctx.arc(this.scale_x(node.x), this.scale_y(node.y), 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "black";
            ctx.font = '10px sans-serif';

            if (this.length_scheme == 'raw') {
                ctx.fillText(`${node.data.name} ${node.data.length.toPrecision(4)}`, this.scale_x(node.x) + 6, this.scale_y(node.y) + 2.5);
            } else {
                ctx.fillText(`${node.data.name}`, this.scale_x(node.x) + 6, this.scale_y(node.y) + 2.5);
            }

        } else {
            ctx.fillStyle = `rgba(128, 128, 128, .8)`;
            if (node.height > 0) {
                ctx.beginPath();
                ctx.arc(this.scale_x(node.x), this.scale_y(node.y), 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Creates an empty line. This is useful for creating a canvas stroke over an existing line,
     * and determining if coordinates lies within it.
     *
     * @param {Object} ctx Canvas context
     * @param {number} source_x Source x-coordinate
     * @param {number} source_y Source y-coordinate
     * @param {number} target_x Target x-coordinate
     * @param {number} target_y Target y-coordinate
     */
    create_empty_line(ctx, source_x, source_y, target_x, target_y) {
        ctx.beginPath();
        ctx.moveTo(source_x, source_y);
        ctx.lineTo(target_x, target_y);
        ctx.lineWidth = 20;
    }

    /**
     * Draws a single line on canvas for phylogram. This can also be used to erase
     * lines if erase_width is set.
     *
     * @param {Object} ctx Canvas context
     * @param {number} source_x Source x-coordinate
     * @param {number} source_y Source y-coordinate
     * @param {number} target_x Target x-coordinate
     * @param {number} target_y Target y-coordinate
     * @param {string} style Canvas strokeStyle
     * @param {number} width Width of line
     * @param {number} erase_width Width of line drawn to erase an old line.
     */
    draw_single_line(ctx, source_x, source_y, target_x, target_y, style, width, erase_width=null) {
        // Eventually create a draw queue. For now we just erase old lines.
        if (erase_width !== null) {
            this.draw_single_line(ctx, source_x, source_y, target_x, target_y, 'white', erase_width);
        }

        ctx.beginPath();
        ctx.moveTo(source_x, source_y);
        ctx.lineTo(target_x, target_y);
        ctx.lineWidth = width;
        ctx.strokeStyle = style;
        ctx.stroke();
    }

    /**
     * Draws a link in the phylogram. This involves drawing both a vertical and a horizontal component.
     *
     * @param {Object} ctx Canvas context
     * @param {number} source_x Source x-coordinate
     * @param {number} source_y Source y-coordinate
     * @param {number} target_x Target x-coordinate
     * @param {number} target_y Target y-coordinate
     * @param {string} style Canvas strokeStyle
     * @param {number} width Width of line
     * @param {number} erase_width Width of line drawn to erase an old line.
     */
    draw_tree_link(ctx, source_x, source_y, target_x, target_y, style=PhylogramPlot.default_link_style, width=1, erase_width=4) {
        this.draw_single_line(ctx, source_x, source_y, source_x, target_y, style, width, erase_width);
        this.draw_single_line(ctx, source_x, target_y, target_x, target_y, style, width, erase_width);
    }

    /**
     * Determines x distance from root for all descendants
     * @param {} root - d3 root node
     */
    static root_distance(root) {
        //Modifies nodes with addition of root_distance property.
        root.leaves().forEach(leaf => {
            let root_dist = 0;
            root.path(leaf).forEach(node => {
                //don't add distance to root node, add distance only once to a node that may be traversed multiple times
                if ((node.parent != null)) {
                    root_dist += node.data.length;
                    if (!node.root_distance) {
                        node.root_distance = root_dist;
                    }
                }
            });
        });
    }

    /**
     * Leaves set how nodes are placed in the y-axis.
     *  Maximally spread out the nodes
     * @param {} root - d3 root node
     */
    static y_node_spacing(root, height, width) {
        //Modifies nodes with addition of unscaled_y value
        const dy = height / root.leaves().length + 1;
        let cur_y = dy;
        const min_y = cur_y;
        let max_y = 0;
        root.leaves().forEach(n => {
            n.y = cur_y;
            cur_y += dy;
            max_y = cur_y;
        });
        return d3.scaleLinear()
            .domain([min_y, max_y])
            .range([10, height - (.10 * height)]);
    }

    /**
     * Work backwards from the leaves, adding y coordinates to each
     * parent level of nodes.
     * @param {} root - d3 root node
     * @param {} scale_x - d3 linearScale function
     * @param {} scale_y - d3 linearScale function
     */
    static set_parent_y(root) {
        function avg_y_coordinates(nodes) {
            if (nodes.length === 1) {
                return nodes[0].y
            } else {
                let v = []
                nodes.forEach(n => { v.push(n.y) })
                return (Math.min(...v) + Math.max(...v)) / v.length
            }
        }

        let parents_by_depth = new Map();
        let depths = [];
        root.descendants().forEach(node => {
            if (node.height > 0) {
                if (!parents_by_depth.get(node.depth)) {
                    parents_by_depth.set(node.depth, []);
                    depths.push(node.depth);
                }
                parents_by_depth.get(node.depth).push(node);
            }
        });
        depths.sort((a, b) => b - a);
        depths.forEach(d => {
            parents_by_depth.get(d).forEach(p => {
                let c_y = avg_y_coordinates(p.children);
                p.y = c_y;
                p.x = p.root_distance;
            });
        });
        //set root y based on its children
        root.y = avg_y_coordinates(root.children)
        root.x = 0;
    }

    /*
     * Creates a d3 hierarchy from phylogram data. Returns scales for drawing x and y dims of branches, and the root object.
     */
    static get_root(data, height, width) {
        let root = d3.hierarchy(data, d => d.branchset)
            .sort((a, b) => d3.ascending(b.data.length, a.data.length))
        PhylogramPlot.root_distance(root);
        //Furthest leaf is as far from the root as possible
        let max_distance = Math.max(...root.leaves().map(l => l.root_distance));

        let scale_x = d3.scaleLinear()
            .domain([0, max_distance])
            .range([5, width - (.3 * width)]);
        let scale_y = PhylogramPlot.y_node_spacing(root, height, width);

        root.leaves().forEach(n => {
            n.x = n.root_distance;
        });

        PhylogramPlot.set_parent_y(root);
        return [scale_x, scale_y, root];
    }

}

export { PhylogramPlot }
