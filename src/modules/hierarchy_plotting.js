import { hierarchy, cluster } from "d3-hierarchy";
import { create, select } from "d3-selection";
import { ascending } from "d3-array";
import { removeChildNodes, cleanExistingPlot, htmlToElement } from "./html_templates";

let event_buld_fn = undefined;

const FILE_NAMES = [RegExp(/[Cc]onsensus Tree/), RegExp(/.*boot.*tree.*/)];

const d3 = Object.assign(
    {},
    { hierarchy, cluster, create, select, ascending }
);

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

const animate = function (data) {
    let tree_num = 0;
    let parsed_branchset = parseNewick(data[tree_num][0]);
    cleanExistingPlot();
    chart_phylogram({ parsed_data: parsed_branchset, dom_id: "plot" });
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
        let pn = parseNewick(data[tn - 1][0]);
        chart_phylogram({ parsed_data: pn, dom_id: "plot" });
    });
}

const hierarchy_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("TreeFileContents", e => {
        if (e.detail.guid === my_guid) {
            //contents is a dict key is file name value is array of data.
            Object.keys(e.detail.contents).forEach(k => {
                if ("Consensus Tree" === k) {
                    let parsed_branchset = parseNewick(e.detail.contents[k][0][0]);
                    cleanExistingPlot();
                    chart_phylogram({ parsed_data: parsed_branchset, dom_id: "plot" });
                }
                if (RegExp(/.*boottree.*/).test(k)) { //TODO: this needs fixing.
                    animate(e.detail.contents[k]);
                }
            })

        }
    });

    addEventListener("TreePlotRequest", e => {
        FILE_NAMES.forEach(rx => {
            if (rx.test(e.detail.file_name)) {
                dispatchEvent(event_buld_fn("TreeFileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
            }
        });
    });

}

export { hierarchy_plot_init }