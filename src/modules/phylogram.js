import { htmlToElement } from "./html_templates";

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

// ------------- Tree Graph
let data_files = undefined;

const tree_parse = tree_parser();

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

const build_dom = function (dom_id, tree_id) {
    let clr_btn = htmlToElement('<button type="button" class="btn btn-primary btn-sm">Clear Tree</button>');
    let e = document.getElementById(dom_id);
    let p_text = htmlToElement('<p class="lead">Tree: ' + String(tree_id) + '</p>');
    clr_btn.addEventListener('click', function (event) {
        let element = event.target.parentNode;
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    });
    e.append(p_text);
    e.append(clr_btn);
    return e;
}

const chart_phylogram = function (obj) {
    const { parsed_data, dom_id, tree_id } = obj;
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
        .text(d => d.data.name + " : " + d.data.length.toPrecision(3))
        .filter(d => d.children)
        .attr("text-anchor", "end")
        .clone(true).lower()
        .attr("stroke", "white");
    let e = build_dom(dom_id, tree_id + 1);
    document.getElementById(dom_id).append(svg.attr("viewBox", autoBox).node());
    e.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
}

let reset_pyhlogram = function (obj) {
    const { dom_id, tree_id } = obj;
    let element = document.getElementById(dom_id);
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    //TODO: tree data if there are multiple tree files in a history???
    let d_tree = undefined;
    Object.keys(data_files).forEach(k => {
        if (data_files[k].length >= tree_id) {
            d_tree = data_files[k][tree_id];
        }
    });
    chart_phylogram({ parsed_data: d_tree, dom_id: dom_id, tree_id: tree_id });
}

const format_data_files = function (raw_data) {
    let r_val = {};
    Object.keys(raw_data).forEach(k => {
        if (k.includes("boottrees")) {
            r_val[k] = tree_parse.boottrees_parse(raw_data[k]);
        }
        if (k.endsWith('nex')) {
            r_val[k] = tree_parse.nexus_parse(raw_data[k].join('\n'));
        }
        if (k.endsWith('newick') || k.endsWith('nhk')) {
            r_val[k] = tree_parse.newick_parse(raw_data[k].join('\n'));
        }
    });
    return r_val;
}

const pyhlogram_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            coordinate_data = clean_data(e.detail.contents);
            let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;
            plot_dimensions(plot_dimension, coordinate_data[Object.keys(coordinate_data)[0]]);
        }
    });

    addEventListener("TreePlotRequest", e => {
        dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_name] }));
    });
}

export { pyhlogram_plot_init }