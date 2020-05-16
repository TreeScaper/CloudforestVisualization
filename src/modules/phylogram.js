import { hierarchy, cluster } from "d3-hierarchy";
import { create, select } from "d3-selection";
import { ascending } from "d3-array";
import { removeChildNodes } from "./html_templates";

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending }
);
let data_files = undefined;
let event_build_fn = undefined;
/**
* Newick tree parsing from 
* https://github.com/jasondavies/newick.js
* 
*/
let newick_parse = function (s, translate_table = {}) {
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
                    if (translate_table[token] != null) {
                        tree.name = translate_table[token];
                    } else {
                        tree.name = token;
                    }
                } else if (x == ':') {
                    tree.length = parseFloat(token);
                }
        }
    }
    return tree;
};

/**
 * Nexus file parsing for embedded newick trees.
 * 
 * @param {String} s 
 */
let nexus_parse = function (s) {
    if (s.search(/NEXUS/) === -1) {
        throw ('Parameter is not a Nexus string.');
    }
    let lines = s.split(/\r?\n|\r/g).filter(v => v.length > 0);
    lines = lines.map(l => l.trim());

    let translate_table = {};
    let tree_table = [];

    let in_begin_trees = false;
    let in_translate = false;
    lines.forEach(lp => {
        let l = lp.toLocaleLowerCase();
        if (l.includes('begin trees')) {
            in_begin_trees = true;
        }
        if (in_begin_trees && l.includes('end;')) {
            in_begin_trees = false;
        }
        if (l.includes('translate')) {
            in_translate = true;
        }
        if (in_translate && !l.includes('translate')) {
            let ar = l.replace(/,|;/, '').split(/\s/).filter(v => v.length > 0);
            translate_table[ar[0]] = ar[1];
        }
        if (in_translate && l.endsWith(';')) {
            in_translate = false;
        }
        if (l.startsWith('tree') && in_begin_trees) {
            in_translate = false;
            tree_table.push(l.substr(l.indexOf('('), l.indexOf(';')));
        }
    });
    let np = tree_table.map(v => newick_parse(v, translate_table));
    return np;
};

let boottrees_parse = function (s) {
    let newick_objs = s.map(v => newick_parse(v[0]));
    return newick_objs;
};


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

const format_data_files = function (raw_data) {
    let r_val = {};
    Object.keys(raw_data).forEach(k => {
        if (RegExp(/[Bb]oottrees/).test(k)) {
            r_val[k] = boottrees_parse(raw_data[k]);
        }
        if (RegExp(/.*nex^/).test(k)) {
            r_val[k] = nexus_parse(raw_data[k].join('\n'));
        }
        if (RegExp(/.*newick^||.*nhk^/).test(k)) {
            r_val[k] = newick_parse(raw_data[k].join('\n'));
        }
    });
    return r_val;
}

const pyhlogram_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("TreeRequest", e => {
        let tree_num = e.detail.tree_number;
        //Do we have more than one bootstap file?
        if (data_files.length > 1) {
            //TODO: Ask the user
        } else {
            removeChildNodes("plot-metadata");
            let f = data_files[Object.keys(data_files)[0]];
            chart_phylogram({
                parsed_data: newick_parse(f[tree_num][0]),
                dom_id: "plot-metadata",
                tree_id: tree_num
            });
            document.getElementById("plot-metadata").scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
        }
    });

    addEventListener("BootstrappedTreeData", e => {
        //Expecting all data files containing bootstrapped trees
        data_files = e.detail.files;
        console.log(`BootstrappedTreeData : ${data_files}`);
    });

    dispatchEvent(event_build_fn("BootstrappedTrees", { guid: my_guid }))
}

export { pyhlogram_plot_init }