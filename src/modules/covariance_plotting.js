import { scaleQuantize } from "d3-scale";
import { forceSimulation, forceCollide, forceManyBody, forceLink, forceX, forceY } from "d3-force";
import { select, event } from "d3-selection";
import { drag } from "d3-drag";
import { mean, max } from "d3-array";

import { roundedRect } from "./canvas_funcs";
import { cleanExistingPlot, htmlToElement } from "./html_templates";

const getEvent = () => event; // This is necessary when using webpack >> https://github.com/d3/d3-zoom/issues/32
const d3 = Object.assign(
    {
        mean,
        max,
        select,
        event,
        getEvent,
        scaleQuantize,
        forceSimulation, forceCollide, forceManyBody, forceLink, forceX, forceY,
        drag
    }
);


let event_buld_fn = undefined;
let graph_data = undefined;
let filtered_adjacency_list = undefined;
let max_covariance = 0;
let num_trees = 0;

const FILE_NAME = "Covariance Matrix";

const parse_covariance = function (m) {
    m.forEach((c, i) => {
        if (i > 0) {
            c.forEach((v, idx) => {
                if (idx > 0 && idx != Number(c[0]) && v.trim().length > 0) {
                    let o = {
                        "source": c[0].trim(),
                        "target": String(idx),
                        "value": Number(v.trim())
                    }
                    graph_data.links.push(o);
                    if (Math.abs((Number(v.trim()))) > max_covariance) {
                        max_covariance = Math.abs(Number(v.trim()));
                    }
                }
            });
        }
    });
}

const parse_bipartition = function (m) {
    let b = {};
    m.forEach(r => {
        let bp_name = String(Number(r[0].trim()) + 1);
        if (!(bp_name in b)) {
            b[bp_name] = [];
        }
        b[bp_name].push(r[1]);
    });

    Object.keys(b).forEach(k => {
        let o = {
            "id": k,
            "num_trees": b[k].length
        };
        graph_data.nodes.push(o);
        if (b[k].length > num_trees) {
            num_trees = b[k].length;
        }
    });
}

/**
     * Return a profile for the requested node, including
     * link information
     * @param {*} node
     */
const profile_node = function (node) {
    let r_val = {
        "id": node.id,
        "num_trees": node.num_trees
    };
    let pos_values = [];
    let neg_values = [];
    graph_data.links.forEach(l => {
        if (l.source.id === node.id || l.target.id === node.id) {
            if (l.value < 0) {
                neg_values.push(l.value);
            }
            if (l.value >= 0) {
                pos_values.push(l.value);
            }
        }
    });
    r_val["num_pos_cova"] = pos_values.length;// || NaN;
    r_val["num_neg_cova"] = neg_values.length;// || NaN;
    r_val["mean_pos_cova"] = d3.mean(pos_values);// || NaN;
    r_val["mean_neg_cova"] = d3.mean(neg_values) || NaN;
    r_val["max_neg_cova"] = -1 * d3.max(neg_values.map(v => Math.abs(v))) || NaN;
    r_val["max_pos_cova"] = d3.max(pos_values);// || NaN;
    return r_val;
}

const draw_profile_legend = function (p) {
    const elm = document.getElementById("plot-metadata");
    let e_string = `
    <h4>Partition ${p.id}</h4>
    <table class="table"><thead><tr>
    <th>Tree Count</th><th># Pos. Cova</th><th>Mean Pos. Cova</th><th>Max Pos. Cova</th>
    <th># Neg. Cova</th><th>Mean Neg. Cova</th><th>Max Neg. Cova</th></tr></thead>
    <tbody>
    <td>${p.num_trees}</td><td>${p.num_pos_cova}</td><td>${p.mean_pos_cova.toPrecision(4)}</td><td>${p.max_pos_cova.toPrecision(4)}</td>
    <td>${p.num_neg_cova}</td><td>${p.mean_neg_cova.toPrecision(4)}</td><td>${p.max_neg_cova.toPrecision(4)}</td>
    </tbody>
    </table>
    `
    elm.innerHTML = e_string;
}

const draw_graph = function (graph_data) {

    const link_scale = d3.scaleQuantize()
        .domain([0, max_covariance])
        .range([.5, 2, 5, 10]);

    let canvas = document.getElementById("topo-network"),
        ctx = canvas.getContext('2d'),
        width = canvas.getAttribute("width"),
        height = canvas.getAttribute("height"),
        r = 10;

    let tick = function () {
        ctx.clearRect(0, 0, width, height);

        ctx.globalAlpha = 0.2;
        graph_data.links.forEach(drawLink);

        graph_data.nodes.forEach(drawNode);
    }

    let drawNode = function (d) {
        let alpha_pct = (d.num_trees / num_trees);
        if (alpha_pct < 0.1) { alpha_pct = 0.1 };
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.globalAlpha = alpha_pct;
        ctx.fillStyle = "black";
        ctx.fill();
    }

    let drawLink = function (l) {
        ctx.beginPath();
        if (l.value < 0) {
            ctx.strokeStyle = "red";
        } else if (l.value > 0) {
            ctx.strokeStyle = "blue";
        } else {
            ctx.strokeStyle = "lime";
            ctx.lineDashOffset = 1;
        }
        ctx.lineWidth = link_scale(Math.abs(l.value));
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();

    }

    let simulation = d3.forceSimulation(graph_data.nodes)
        .force("x", d3.forceX(width / 2))
        .force("y", d3.forceY(height / 2))
        .force("charge", d3.forceManyBody().strength(-20))
        .force("link", d3.forceLink()
            .id(function (d) { return d.id; }).distance(width / 3));

    simulation.on("tick", tick);
    simulation.force("link")
        .links(graph_data.links);

    let dragstarted = function () {
        if (!d3.getEvent().active) simulation.alphaTarget(0.3).restart();
        d3.getEvent().subject.fx = d3.getEvent().subject.x;
        d3.getEvent().subject.fy = d3.getEvent().subject.y;
    }

    let dragged = function () {
        d3.getEvent().subject.fx = d3.getEvent().x;
        d3.getEvent().subject.fy = d3.getEvent().y;
    }

    let dragended = async function () {
        if (!d3.getEvent().active) simulation.alphaTarget(0);
        d3.getEvent().subject.fx = null;
        d3.getEvent().subject.fy = null;
        let p = profile_node(d3.getEvent().subject);
        draw_profile_legend(p);
        ctx.beginPath();
        ctx.fillStyle = "black";
        ctx.globalAlpha = 0.5;
        roundedRect(ctx, d3.getEvent().subject.x - 10, d3.getEvent().subject.y - 30, 250, 50, 5);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "white";
        ctx.font = "bold 15px Arial";
        ctx.fillText(`Partition ${p.id} - Trees: ${p.num_trees} `, d3.getEvent().subject.x, d3.getEvent().subject.y, 200);
        simulation.stop();
        await new Promise(r => setTimeout(r, 1000));
        simulation.restart();
    }

    let dragsubject = function () {
        return simulation.find(d3.getEvent().x, d3.getEvent().y);
    }

    d3.select(canvas)
        .call(d3.drag()
            .container(canvas)
            .subject(dragsubject)
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

}

const build_dom = function () {
    cleanExistingPlot();
    let doc_width = document.getElementById("plot").clientWidth;
    let div_width = Math.floor((doc_width - (.15 * doc_width)) / 100) * 100;
    let div_height = div_width / 2;

    let canvas_elm = htmlToElement(`<canvas id="topo-network" width="${div_width}" height="${div_height}">`);
    document.getElementById("plot").append(canvas_elm);
    build_link_edit_ui();
}

const build_matrix = function (graph_data) {
    filtered_adjacency_list = {}; //Matrix as adjacency list
    graph_data.nodes.forEach(n => {
        filtered_adjacency_list[n.id] = [];
    });
    graph_data.links.forEach(l => {
        filtered_adjacency_list[l.source.id].push({ id: l.target.id, covariance: l.value });
    });
}

const update_graph = function (conf_update) {
    let link_strength_thresh = conf_update.link_threshold / 100.0;
    //edit the links
    let edited_links = [];
    graph_data.links.forEach(obj => {
        if (Math.abs(obj.value) >= (link_strength_thresh * max_covariance)) {
            edited_links.push(obj);
        }
    });
    draw_graph({
        nodes: graph_data.nodes,
        links: edited_links
    });

    build_matrix({
        nodes: graph_data.nodes,
        links: edited_links
    });
    document.getElementById("publish-graph").disabled = false;
}

const build_link_edit_ui = function () {
    let pcc = document.getElementById("plot-controls");

    pcc.append(htmlToElement(`<div class="field has-addons">
        <h4>Remove Links Below X% of Maximum Magnitude</h4>
        <div class="control">
            <input type="number" id="link-strength" min="1" max="99" value="95" size="4"></input>
        </div >
        <div class="control">
            <a id="btn-links-reset" class="button is-info">Reset</a>
        </div>
        </div > `));

    pcc.append(htmlToElement(`<div class="field has-addons">
    <h4>Publish Filtered Graph</h4>
    <div class="control">
        <button id="publish-graph" class="button is-info">Publish</button>
    </div>`));

    document.getElementById("publish-graph").disabled = true;

    document.getElementById("link-strength").addEventListener("input", event => {
        let thresh = Number(document.getElementById("link-strength").value);
        update_graph({
            link_threshold: thresh
        });
    });

    document.getElementById("btn-links-reset").addEventListener("click", event => {
        draw_graph(graph_data);
        document.getElementById("publish-graph").disabled = true;
    });

    document.getElementById("publish-graph").addEventListener("click", () => {
        dispatchEvent(event_buld_fn("PublishData", { guid: my_guid, data: filtered_adjacency_list }));
    });
}

const covariance_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            graph_data = {
                "nodes": [],
                "links": []
            };
            parse_bipartition(e.detail.contents["Bipartition Matrix"]);
            parse_covariance(e.detail.contents[FILE_NAME]);
            build_dom();
            draw_graph(graph_data);
        }
    });

    addEventListener("TreePlotRequest", e => {
        if (e.detail.file_name === FILE_NAME) {
            dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: [FILE_NAME, "Bipartition Matrix"] }));
        }
    });

}

export { covariance_plot_init }