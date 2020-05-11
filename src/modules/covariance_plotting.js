import { scaleQuantize } from "d3-scale";
import { forceSimulation, forceCollide, forceManyBody, forceLink, forceX, forceY } from "d3-force";
import { select, event } from "d3-selection";
import { drag } from "d3-drag";

import { removeChildNodes, htmlToElement } from "./html_templates";

const getEvent = () => event; // This is necessary when using webpack >> https://github.com/d3/d3-zoom/issues/32
const d3 = Object.assign(
    {
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
        console.log('DRAG ENDED');
        let p = profile_node(d3.getEvent().subject);
        draw_profile_legend(p);
        ctx.beginPath();
        ctx.fillStyle = "black";
        ctx.globalAlpha = 0.5;
        cf.roundedRect(ctx, d3.getEvent().subject.x - 10, d3.getEvent().subject.y - 30, 250, 50, 5);
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
    removeChildNodes("plot");
    let doc_width = document.getElementById("plot").clientWidth;
    let div_width = Math.floor((doc_width - (.15 * doc_width)) / 100) * 100;
    let div_height = div_width / 2;

    let canvas_elm = htmlToElement(`<canvas id="topo-network" width="${div_width}" height="${div_height}">`);
    document.getElementById("plot").append(canvas_elm);
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