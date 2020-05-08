import { hierarchy, cluster } from 'd3-hierarchy'
import { create } from 'd3-selection';
import { ascending } from 'd3-array';

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, ascending }
);

const string_parser = function (s) {
    const split_data = s.split(/\r?\n|\r/g).filter(v => v.length > 0);
    let parsed_data = [];
    split_data.forEach(d => {
        parsed_data.push(d.split(/\t/));
    });
    return parsed_data;
};

const data = {
    "consensus_tree": `(LngfishAu:1.000000,(LngfishSA:1.000000,LngfishAf:1.000000):1.000000,(Frog:1.000000,(((Platypus:1.000000,Opossum:1.000000):0.983000,((Mouse:1.000000,Rat:1.000000):1.000000,(Human:1.000000,(Seal:1.000000,(Cow:1.000000,Whale:1.000000):0.994000):0.683000):0.894000):0.991000):1.000000,(Sphenodon:1.000000,Lizard:1.000000,(Turtle:1.000000,(Crocodile:1.000000,Bird:1.000000):0.977000):0.713000):0.981000):0.999000):1.000000);`
};

const get_data = function (data_name) {
    return string_parser(data[data_name]);
};

// https://github.com/jasondavies/newick.js
const parseNewick = function (s) {
    var ancestors = [];
    var tree = {};
    var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        switch (token) {
            case '(': // new branchset
                var subtree = {};
                tree.branchset = [subtree];
                ancestors.push(tree);
                tree = subtree;
                break;
            case ',': // another branch
                var subtree = {};
                ancestors[ancestors.length - 1].branchset.push(subtree);
                tree = subtree;
                break;
            case ')': // optional name next
                tree = ancestors.pop();
                break;
            case ':': // optional length next
                break;
            default:
                var x = tokens[i - 1];
                if (x == ')' || x == '(' || x == ',') {
                    tree.name = token;
                } else if (x == ':') {
                    tree.length = parseFloat(token);
                }
        }
    }
    return tree;
};

let newick_string = get_data("consensus_tree").toLocaleString();
let parsed_data = parseNewick(newick_string);

const autoBox = function () {
    document.body.appendChild(this);
    const {
        x,
        y,
        width,
        height
    } = this.getBBox();
    document.body.removeChild(this);
    return [x, y, width, height];
}

const chart_phylogram = function (obj) {
    const { parsed_data, dom_id } = obj;
    const root = d3.hierarchy(parsed_data, d => d.branchset)
        .sum(d => d.branchset ? 0 : 1)
        .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length, b.data.length));
    root.dx = 10;
    root.dy = 75;
    d3.cluster().nodeSize([root.dx, root.dy])(root);

    const svg = d3.create("svg");

    svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", d => `
        M${d.target.y},${d.target.x}
        C${d.source.y + root.dy / 2},${d.target.x}
         ${d.source.y + root.dy / 2},${d.source.x}
         ${d.source.y},${d.source.x}
      `);

    svg.append("g")
        .selectAll("circle")
        .data(root.descendants())
        .join("circle")
        .attr("cx", d => d.y)
        .attr("cy", d => d.x)
        .attr("fill", d => d.children ? "#555" : "#999")
        .attr("r", 2.5);

    svg.append("g")
        .attr("font-size", 8)
        .selectAll("text")
        .data(root.descendants())
        .join("text")
        .filter(d => d.data.name.length === 0)
        .attr("x", d => d.y)
        .attr("y", d => {
            return (d.x - 10);
        })
        .attr("dy", "0.31em")
        .filter(d => d.data.length != undefined)
        .text(d => d.data.length.toPrecision(4));

    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .selectAll("text")
        .data(root.descendants())
        .join("text")
        .attr("x", d => d.y)
        .attr("y", d => d.x)
        .attr("dy", "0.31em")
        .attr("dx", d => d.children ? -6 : 6)
        .filter(function (d) {
            return d.data.name.length != 0;
        })
        //.text(d => d.data.name + " : " + d.data.length.toPrecision(3))
        .text(d => d.data.name)
        .filter(d => d.children)
        .attr("text-anchor", "end")
        .clone(true).lower()
        .attr("stroke", "white");
    document.getElementById(dom_id).append(svg.attr("viewBox", autoBox).node());
}
chart_phylogram({
    parsed_data: parsed_data,
    dom_id: "plot"
});
console.log("PK");