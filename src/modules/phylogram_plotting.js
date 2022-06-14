/**
 * Creates a traditional phylogenetic tree respecting supplied distances
 *
 * Generates and returns an svg element based on event request.
 */
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { create, select } from "d3-selection";
import { ascending } from "d3-array";
import { scaleLinear, eas } from "d3-scale";
import { htmlToElement } from "./utilities/html_templates";
import { build_event } from "./utilities/support_funcs";

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending, scaleLinear }
);

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
const y_node_spacing = function (root, height, width) {
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

const get_root = function (data, height, width) {
    let root = d3.hierarchy(data, d => d.branchset)
        .sort((a, b) => d3.ascending(b.data.length, a.data.length))
    root_distance(root);
    //Furthest leaf is as far from the root as possible
    let max_distance = Math.max(...root.leaves().map(l => l.root_distance));

    let scale_x = d3.scaleLinear()
        .domain([0, max_distance])
        .range([10, width - (.2 * width)]);
    let scale_y = y_node_spacing(root, height, width);

    root.leaves().forEach(n => {
        n.x = n.root_distance;
    });

    set_parent_y(root);
    return [scale_x, scale_y, root];
}

/**
 * Create an canvas element consisting of a phylogenetic tree.
 *
 * @param {*} data - tree data
 */
const create_tree = function (data, height, width) {
    let [scale_x, scale_y, root] = get_root(data, height, width);
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

const animate = function (data) {
    let tree_num = 0;
    let parsed_branchset = parseNewick(data[tree_num]);
    cleanExistingPlot();
    dispatchEvent(build_event("PlotForTree", {
        tree_num: 1,
        tree: parsed_branchset,
        width: document.getElementById("plot").clientWidth,
        height: .75 * document.getElementById("plot").clientWidth,
        plot_div: "plot"
    }));

    const control_div = document.getElementById("plot-controls");
    control_div.classList.add("box");
    control_div.append(htmlToElement(`
    <div class="field"><div class="control"><label for="boottree-slider">Tree Number: <span id="boottree-number">1</span></label>
    <input type="range" id="boottree-slider" name="boottree"
    min="1" max="${data.length - 1}" step="1" value="1" style="width: 60em;"></div></div>`));

    document.getElementById("boottree-slider").addEventListener("input", () => {
        let tn = Number(document.getElementById("boottree-slider").value);
        document.getElementById("boottree-number").textContent = tn;
        removeChildNodes("plot");
        let pn = parseNewick(data[tn - 1]);
        create_tree(pn, .75 * document.getElementById("plot").clientWidth, document.getElementById("plot").clientWidth);
    });
}

const phylogram_init = function (init_obj) {
    let { guid_fn } = init_obj;
    const my_guid = guid_fn();

    addEventListener("TreeFileContents", e => {
        if (e.detail.guid === my_guid) {
            e.detail.contents.forEach(item => {
                if (/consensus tree/i.test(item.fileName)) {
                    let parsed_branchset = parseNewick(item.data);
                    cleanExistingPlot();
                    create_tree(parsed_branchset, .75 * document.getElementById("plot").clientWidth, document.getElementById("plot").clientWidth);
                } else {
                    animate(item.data.split(';')); //data string of trees into an array.
                }
            })

        }
    });
    addEventListener("TreePlotRequest", e => {
        dispatchEvent(build_event("TreeFileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
    });
}

export {
    root_distance,
    y_node_spacing,
    set_parent_y,
    get_root,
    phylogram_init}
