/**
 * Creates a traditional phylogenetic tree respecting supplied distances
 * 
 * Generates and returns an svg element based on event request.
 */
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { create, select } from "d3-selection";
import { ascending } from "d3-array";
import { scaleLinear, eas } from "d3-scale";
import { htmlToElement } from "./html_templates";
import { build_event } from "./support_funcs";

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending, scaleLinear }
);

let width = undefined;
let height = undefined;
let plot_div = undefined;
let tree_number = undefined;

/**
 * Determines x distance from root for all descendants
 * @param {} root - d3 root node
 */
const root_distance = function (root) {
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
const y_node_spacing = function (root) {
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
const set_parent_y = function (root) {

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

/**
 * Create an canvas element consisting of a phylogenetic tree.
 * 
 * @param {*} data - tree data
 */
const create_tree = function (data) {
    let root = d3.hierarchy(data, d => d.branchset)
        .sort((a, b) => d3.ascending(b.data.length, a.data.length))
    root_distance(root);
    //Furthest leaf is as far from the root as possible
    let max_distance = Math.max(...root.leaves().map(l => l.root_distance));

    let scale_x = d3.scaleLinear()
        .domain([0, max_distance])
        .range([10, width - (.10 * width)]);
    let scale_y = y_node_spacing(root);

    root.leaves().forEach(n => {
        n.x = n.root_distance;
    });

    set_parent_y(root);

    let canvas = document.createElement('canvas');
    canvas.setAttribute("width", width);
    canvas.setAttribute("height", height);

    if (tree_number) {
        document.getElementById(`${plot_div}`).append(htmlToElement(`<div><h3>Tree ${tree_number}</h3></div>`));
    }

    document.getElementById(`${plot_div}`).append(canvas);
    let ctx = canvas.getContext('2d');

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = `rgba(128, 128, 128, .4)`;
    ctx.lineWidth = 1.5;
    root.links().forEach(link => {
        ctx.beginPath();
        ctx.moveTo(scale_x(link.source.x), scale_y(link.source.y));
        ctx.lineTo(scale_x(link.source.x), scale_y(link.target.y));
        ctx.lineTo(scale_x(link.target.x), scale_y(link.target.y));
        ctx.stroke();
    });

    root.leaves().forEach(leaf => {
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(scale_x(leaf.x), scale_y(leaf.y), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.font = '10px sans-serif';
        ctx.fillText(`${leaf.data.name} ${leaf.data.length.toPrecision(4)}`, scale_x(leaf.x) + 6, scale_y(leaf.y) + 2.5);
    });

    ctx.fillStyle = `rgba(128, 128, 128, .8)`;
    root.descendants().forEach(node => {
        if (node.height > 0) {
            ctx.beginPath();
            ctx.arc(scale_x(node.x), scale_y(node.y), 5, 0, Math.PI * 2);
            ctx.fill();
            if (node.depth > 0) {
                ctx.fillStyle = "black";
                ctx.font = '8px sans-serif';
                ctx.fillText(`${node.data.length.toPrecision(4)}`, scale_x(node.x) + 6, scale_y(node.y) + 2.5);
            }
        }
    });
}

const tree_plot_init = function () {

    addEventListener("BipartitionsForTree", e => {

    });

    addEventListener("PlotForTree", e => {
        let tree_data = e.detail.tree;
        tree_number = e.detail.tree_num;
        width = e.detail.width;
        height = e.detail.height;
        plot_div = e.detail.plot_div

        create_tree(tree_data)
    });
}

export { tree_plot_init }
