/**
 * Creates a traditional phylogenetic tree respecting supplied distances
 * 
 * Generates and returns an svg element based on event request.
 */
import { hierarchy, cluster } from "d3-hierarchy";
import { create, select } from "d3-selection";
import { ascending } from "d3-array";
import { transition } from "d3-transition";

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending, transition }
);

let event_build_fn = undefined;
let width = undefined;
let height = undefined;

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
        n.unscaled_y = cur_y;
        cur_y += dy;
        max_y = cur_y;
    });
    return d3.scaleLinear()
        .domain([min_y, max_y])
        .range([10, height]);
}

/**
 * Work backwards from the leaves, adding y coordinates to each 
 * parent level of nodes.
 * @param {} root - d3 root node 
 * @param {} scale_x - d3 linearScale function
 * @param {} scale_y - d3 linearScale function
 */
const set_parent_y = function (root, scale_x, scale_y) {
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
            p.y = scale_y(c_y);
            p.x = scale_x(p.root_distance);
        });
    });
    //set root y based on its children
    root.y = avg_y_coordinates(root.children)
    root.x = 10;
}

/**
 * Create an SVG element consisting of a phylogenetic tree.
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
        .range([10, width]);
    let scale_y = y_node_spacing(root);
    root.leaves().forEach(n => {
        n.x = scale_x(n.root_distance);
        n.y = scale_y(n.unscaled_y);
    });
    set_parent_y(root, scale_x, scale_y);

    let div = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    let svg = d3.create("svg");
    svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.1)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", d => `
        M ${d.source.x},${d.source.y} 
        V ${d.target.y}
        H ${d.target.x}
        `);

    svg.append("g")
        .selectAll("circle")
        .data(root.leaves())
        .join("circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("fill", "blue")
        .attr("r", 4);

    svg.append("g")
        .attr("font-size", 10)
        .attr("font-family", "sans-serif")
        .selectAll("text")
        .data(root.leaves())
        .join("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("dx", "1em")
        .attr("dy", "0.4em")
        .text(d => { return `${d.data.name}:${d.data.length.toPrecision(4)}` })

    let t = d3.transition()
        .duration(100)
        .ease(d3.easeLinear);

    svg.append("g")
        .selectAll("circle")
        .data(root.descendants())
        .join("circle")
        .filter(d => d.height > 0)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("fill", "gray")
        .attr("opacity", "0.8")
        .attr("r", 4)
        .on("mouseover", function (d) {
            d3.select(".tooltip")
                .transition(t)
                .style("opacity", .9);
            div.html(d.data.length)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 10) + "px");
        })
        .on("mouseout", function (d) {
            d3.select(".tooltip").transition(t)
                .style("opacity", 0);
        });
    return svg;
}

const tree_plot_init = function (init_obj) {
    const { event_fn } = init_obj;
    event_build_fn = event_fn;

    addEventListener("PlotForTree", e => {
        let tree_data = e.tree;
        width = e.width;
        height = e.height;

        let tree_svg = create_tree(tree_data);
        event_build_fn("TreeSVG", { tree: tree_svg });
    });
}

export { tree_plot_init }