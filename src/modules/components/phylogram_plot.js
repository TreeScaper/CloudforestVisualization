import { scalequantize } from "d3-scale";
import { forcesimulation, forcecollide, forcemanybody, forcelink, forcex, forcey, forcecenter } from "d3-force";
import { create, select } from "d3-selection";
import { drag } from "d3-drag";
import { mean, max, ascending } from "d3-array";
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { scaleLinear, eas } from "d3-scale";
import { removeChildNodes, cleanExistingPlot, htmlToElement } from "../utilities/html_templates";
import { css_colors } from "../utilities/colors";
import { build_event, set_equality, set_background } from "../utilities/support_funcs.js";
import { newick_parse } from "./tree_data_parsing.js"
import { CloudForestPlot } from "./cloudforest_plot.js";

class PhylogramPlot extends CloudForestPlot {

    static slider_element_id = 'boottree-slider';
    static canvas_plot_element_id = 'tree-canvas';
    static tree_number_element_id = 'boottree-number';
    // Default color for lines in phylogram.
    static default_link_style = `rgba(128, 128, 128, 1)`;

    // Radius for tree nodes
    static tree_node_r = 5;

    boottree_data = undefined;
    canvas = undefined;
    scale_x = undefined;
    scale_y = undefined;

    // Links in phylogram
    tree_links = [];

    // Phylogram root
    tree_root = undefined;

    constructor(plot, controls, metadata) {
        super(plot, controls, metadata);
    }

    parse_boottree_data(d) {
        this.boottree_data = d.split(';');
    }

    build_controls() {
        let pcc = document.getElementById(this.controls);
        // Create slider for selecting tree to display
        pcc.append(htmlToElement(`
        <div class="field"><div class="control"><label for="${PhylogramPlot.slider_element_id}">Tree Number: <span id="${PhylogramPlot.tree_number_element_id}">1</span></label>
        <input type="range" id="${PhylogramPlot.slider_element_id}" name="boottree"
        min="1" max="${this.boottree_data.length - 1}" step="1" value="1" style="width: 60em;">
            </div></div>`));
    }


    /**
     * Redraws phylogram on existing tree-canvas element.
     */
    draw_phylogram() {
        let ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        set_background(PhylogramPlot.canvas_plot_element_id);
    
        // Draw highlighted links as purple
        this.tree_links.forEach(t => {
            // DEV
            //if (t == current_link || selected_links.includes(t)) {
            //    this.draw_tree_link(ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.target.x, t.scaled_coord.target.y, 'purple', 3, 2);
            //} else {
                this.draw_tree_link(ctx, t.scaled_coord.source.x, t.scaled_coord.source.y, t.scaled_coord.target.x, t.scaled_coord.target.y);
            //}
        });
    
        // Leaves are drawn blue.
        this.tree_root.leaves().forEach(leaf => {
            ctx.fillStyle = "blue";
            ctx.beginPath();
            ctx.arc(this.scale_x(leaf.x), this.scale_y(leaf.y), 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "black";
            ctx.font = '10px sans-serif';
            ctx.fillText(`${leaf.data.name} ${leaf.data.length.toPrecision(4)}`, this.scale_x(leaf.x) + 6, this.scale_y(leaf.y) + 2.5);
        });

        // Left off here - keep going through this function.. from draw() on down call stack.
    
        // The remainding nodes are grey.
        ctx.fillStyle = `rgba(128, 128, 128, .8)`;
        this.tree_root.descendants().forEach(node => {
            if (node.height > 0) {
                ctx.beginPath();
                ctx.arc(this.scale_x(node.x), this.scale_y(node.y), 5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }


    /*
     * Create phylogram visualization. There is some redundancy between this and create_tree() in phylogram.js.
     */
    draw() {

        // Get width of the plot element for phylogram
        let doc_width = document.getElementById(this.plot).clientWidth;

        // Create a square canvas with fractional width and height
        let width = Math.floor((doc_width - (.15 * doc_width)) / 100) * 100;
        let height = width;

        // Remove nodes from the plot
        // DEV NOTE: is this necessary?
        removeChildNodes(this.plot);

        // Get value of current tree
        let tree_number = Number(document.getElementById(PhylogramPlot.slider_element_id).value);

        // Display current tree value in interface
        document.getElementById(PhylogramPlot.tree_number_element_id).textContent = tree_number;

        // Get data for current tree
        let tree_data = newick_parse(this.boottree_data[tree_number - 1]);
        
        // Create new canvas
        this.canvas = document.createElement('canvas');

        // Get scaling values for drawing phylogram
        [this.scale_x, this.scale_y, this.tree_root] = PhylogramPlot.get_root(tree_data, height, width);

        // Set canvas attributes
        this.canvas.setAttribute('id', PhylogramPlot.canvas_plot_element_id)
        this.canvas.setAttribute("width", width);
        this.canvas.setAttribute("height", height);

        // Create title with tree number
        if (tree_number) {
            document.getElementById(this.plot).append(htmlToElement(`<div><h3>Tree ${tree_number}</h3></div>`));
        }
        
        // Add canvas to document
        document.getElementById(this.plot).append(this.canvas);

        // Get canvas context and fill entirely white
        let ctx = this.canvas.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);

        // Draw links
        ctx.lineWidth = 1.5;
        this.tree_links = [];
        this.tree_root.links().forEach(link => {
            let scaled_link = {
                    "source": {
                            "x": this.scale_x(link.source.x),
                            "y": this.scale_y(link.source.y)
                        },
                    "target": {
                            "x": this.scale_x(link.target.x),
                            "y": this.scale_y(link.target.y)
                        }
                }
            this.tree_links.push({'link': link, 'scaled_coord': scaled_link});
        });

        // DEV
        //selected_links = [];

        // This function is similar to the mousemove event for the covariance network in this same file.
        // Commented out at this point in development. This will need to be abstracted out of phylogram_plot.
        /*
        */

        // Add event handler for the tree number slide. Redraw the tree with draw_tree() each time it changes.
        document.getElementById(PhylogramPlot.slider_element_id).addEventListener("input", () => {
            this.draw();
        });

        this.draw_phylogram();
        
        return this.canvas;
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
    
        // Account for node radius
        let adjusted_source_y = source_y;
        let adjusted_target_y = target_y;
        if (source_y < target_y) {
            adjusted_source_y = source_y + PhylogramPlot.tree_node_r;
        } else if (source_y > target_y) {
            adjusted_source_y = source_y - PhylogramPlot.tree_node_r;
        }
    
        let adjusted_source_x = source_x;
        let adjusted_target_x = target_x;
        if (source_x < target_x) {
            adjusted_target_x = target_x - PhylogramPlot.tree_node_r;
        } else if (source_x > target_x) {
            adjusted_target_x = target_x + PhylogramPlot.tree_node_r;
        }
    
        // Eventually create a draw queue. For now we just erase old lines.
        if (erase_width !== null) {
            this.draw_single_line(ctx, source_x, source_y, target_x, target_y, 'white', erase_width);
        }
    
        ctx.beginPath();
        ctx.moveTo(adjusted_source_x, adjusted_source_y);
        ctx.lineTo(adjusted_target_x, adjusted_target_y);
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
            .range([10, width - (.2 * width)]);
        let scale_y = PhylogramPlot.y_node_spacing(root, height, width);
    
        root.leaves().forEach(n => {
            n.x = n.root_distance;
        });
    
        PhylogramPlot.set_parent_y(root);
        return [scale_x, scale_y, root];
    }

}

export { PhylogramPlot }
