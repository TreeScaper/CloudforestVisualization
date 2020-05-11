import { scaleSequential } from "d3-scale";
import { interpolatePiYG } from "d3-scale-chromatic";
import { forceSimulation, forceCollide, forceManyBody, forceX, forceY } from "d3-force";
import { select, event } from "d3-selection";
import { drag } from "d3-drag";
import { htmlToElement, cleanExistingPlot } from './html_templates';

let score_array = undefined;
let event_buld_fn = undefined;
let parsed_data = undefined;
let score_set = new Set();
const FILE_NAME = "Affinity Matrix";

const getEvent = () => event; // This is necessary when using webpack >> https://github.com/d3/d3-zoom/issues/32
const d3 = Object.assign(
    {
        select,
        event,
        getEvent,
        scaleSequential,
        interpolatePiYG,
        forceSimulation, forceCollide, forceManyBody, forceX, forceY,
        drag
    }
)

const build_slider = function (e) {
    let a_slider = `
                <p>Group by Affinitity Score:</p >
                    <input type="range" id="affinity-slider" name="affinity"
                        min="0" max="${score_array.length - 1}" step="1" value="${score_array[score_array.length - 1]}">
                        <span id="affinity-value">${score_array[score_array.length - 1]}</span>`;
    e.innerHTML = a_slider;

    let s = document.getElementById("affinity-slider");
    s.addEventListener("input", () => {
        document.getElementById("affinity-value").textContent = score_array[s.value];
        filter_links(parsed_data, score_array[s.value]);
    });
    e.classList.add("box");
}

const build_dom = function () {
    cleanExistingPlot();
    let plot_div = document.getElementById("plot");
    let doc_width = plot_div.clientWidth;
    let div_width = Math.floor((doc_width - (doc_width * .15)) / 100) * 100;
    let div_height = div_width / 2;
    plot_div.append(htmlToElement(`<canvas id="ballons" width=${div_width} height=${div_height}></canvas>`));
    build_slider(document.getElementById("plot-controls"));
}

const draw_ballon_graph = function (b_nodes) {
    let canvas = document.getElementById("ballons"),
        ctx = canvas.getContext('2d'),
        width = canvas.getAttribute("width"),
        height = canvas.getAttribute("height"),
        color = d3.scaleSequential(d3.interpolatePiYG);

    let ballon_sim = d3.forceSimulation()
        .force("collide", d3.forceCollide(d => d.radius + 2))
        .force("charge", d3.forceManyBody())
        .velocityDecay(0.75)
        .alphaDecay(0.006)
        .force("y", d3.forceY(height / 2))
        .force("x", d3.forceX(width / 2));

    let b_update = function () {
        ctx.clearRect(0, 0, width, height);
        b_nodes.forEach(draw_b_node);
    }

    let draw_b_node = function (d) {
        ctx.beginPath();

        ctx.moveTo(d.x, d.y);
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        if (d.id === "No Group") {
            ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        } else {
            ctx.fillStyle = color(d.id / 10);
        }
        ctx.fill();
        if (d.count > 10) {
            ctx.fillStyle = "black";
            ctx.font = "bold 12px Arial";
            ctx.fillText(`Group: ${d.id} - Tree Count: ${d.count}`, d.x - (d.count / 3), d.y);
        }
    }

    let dragstarted = function () {
        if (!d3.getEvent().active) ballon_sim.alphaTarget(0.3).restart();
        d3.getEvent().subject.fx = d3.getEvent().subject.x;
        d3.getEvent().subject.fy = d3.getEvent().subject.y;
    }

    let dragged = function () {
        d3.getEvent().subject.fx = d3.getEvent().x;
        d3.getEvent().subject.fy = d3.getEvent().y;
    }

    let dragended = async function () {
        if (!d3.getEvent().active) ballon_sim.alphaTarget(0);
        d3.getEvent().subject.fx = null;
        d3.getEvent().subject.fy = null;
        if (d3.getEvent().subject.count <= 10) {
            ctx.beginPath();
            ctx.fillStyle = "black";
            ctx.font = "bold 12px Arial";
            ctx.fillText(`Group: ${d3.getEvent().subject.id} - Tree Count: ${d3.getEvent().subject.count}`, d3.getEvent().subject.x, d3.getEvent().subject.y);
        }
        ballon_sim.stop();
        ballon_sim.restart();
    }

    let dragsubject = function () {
        return ballon_sim.find(d3.getEvent().x, d3.getEvent().y);
    }
    ballon_sim.nodes(b_nodes).on("tick", b_update);
    d3.select(canvas)
        .call(d3.drag()
            .container(canvas)
            .subject(dragsubject)
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

}

const build_ballon_nodes = function (nodes) {
    let r_val = { nodes: [] };

    let new_nodes = {};
    nodes.forEach(n => {
        if (!(n.group in new_nodes)) {
            new_nodes[n.group] = { "id": n.group, "count": 0 };
        }
        new_nodes[n.group]["count"] += 1;
    });
    Object.keys(new_nodes).forEach(k => {
        r_val['nodes'].push(new_nodes[k]);
    });
    //Calculate node radius.
    const c_area = document.getElementById("ballons").getAttribute('width') * document.getElementById("ballons").getAttribute('height');
    const n_area = Object.keys(new_nodes).reduce(function (accumulator, k) {
        return accumulator + ((new_nodes[k].count * new_nodes[k].count) * Math.PI);
    }, 0);
    if ((n_area / c_area) > .50) {
        r_val.nodes.forEach(n => {
            n.radius = n.count * (.60 / (n_area / c_area));
        });
    } else {
        r_val.nodes.forEach(n => {
            n.radius = n.count;
        })
    }
    if (r_val.nodes.length === 1) {
        r_val.nodes[0].radius = document.getElementById("ballons").getAttribute('height') / 2.5;
    }
    return r_val;
}

const aggregate_test = function (source, target, sets) {
    let needs_agg = true;
    sets.forEach(s => {
        if (s.has(source) || s.has(target)) {
            s.add(source);
            s.add(target);
            needs_agg = false;
        }
    });
    if (needs_agg) {
        let new_set = new Set();
        new_set.add(source);
        new_set.add(target);
        sets.push(new_set);
    }
}

const filter_links = function (data, threshold) {
    let filter_links = data.links.filter(l => l.value >= threshold);
    let link_groups = [new Set()];
    let filter_nodes = data.nodes.map(n => {
        return {
            id: n.id,
            group: n.group
        };
    }); //need a deep copy.

    filter_links.forEach(l => {
        aggregate_test(l.source, l.target, link_groups)
    });

    //set group id for nodes based on aggregation
    filter_nodes.forEach(n => {
        link_groups.forEach((g, idx) => {
            for (let item of g) {
                if (n.id === item) {
                    n["group"] = String(idx);
                }
            }
        });
    });
    draw_ballon_graph(build_ballon_nodes(filter_nodes).nodes);
}

const parse_affinity_matrix = function (data) {
    let m = data[FILE_NAME];
    let link_groups = [new Set()]; //Use to group nodes into aggregated sets based on links.
    let json_data = {
        "nodes": [],
        "links": []
    };

    let ids = [];
    m.forEach((element, idx) => {
        if (idx > 0) {
            json_data["nodes"].push({
                "id": String(element[0]).trim(),
                "group": "No Group"
            });
            ids.push(String(element[0]));
        }

    });
    m.forEach((element, idx) => {
        if (idx > 0) {
            let source = element[0].trim();
            element.splice(1).forEach((e, i) => {
                if (e.trim().length > 0) {
                    let target = ids[i].trim();
                    let value = Number(e);
                    if (source != target) {
                        score_set.add(value);
                        json_data["links"].push({
                            "source": source,
                            "target": target,
                            "value": value
                        });
                    }
                }
            });
        }
    });

    //set group id for nodes based on aggregation
    json_data.nodes.forEach(n => {
        link_groups.forEach((g, idx) => {
            for (let item of g) {
                if (n.id === item) {
                    n["group"] = String(idx);
                }
            }
        });
    });

    return json_data;
}

const affinity_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            parsed_data = parse_affinity_matrix(e.detail.contents);
            score_array = [...score_set].sort((a, b) => a - b); //low to high unique affinity scores
            build_dom();
            filter_links(parsed_data, score_array[score_array.length - 1]);
        }
    });

    addEventListener("TreePlotRequest", e => {
        if (e.detail.file_name === FILE_NAME) {
            dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_name] }));
        }
    });

}

export { affinity_plot_init }