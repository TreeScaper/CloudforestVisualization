import { scaleSequential } from "d3-scale";
import { interpolatePiYG } from "d3-scale-chromatic";
import { forceSimulation, forceCollide, forceManyBody, forceX, forceY } from "d3-force";
import { select, event } from "d3-selection";
import { drag } from "d3-drag";
import { htmlToElement, cleanExistingPlot } from '../utilities/html_templates';
import { isNull } from "plotly.js-gl2d-dist";
import { build_event } from "../utilities/support_funcs";

let score_array = undefined;
let event_buld_fn = undefined;
let parsed_data = undefined;
let score_set = new Set();
const FILE_NAME_REGEXP = /^Affinity Matrix/;

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

const build_option = function (e) {
    let html_string = '<label>Affinity Score:<select id="affinity-select">';
    score_array.forEach((v, i) => {
        if (i === (score_array.length -1)) {
            html_string += `<option value="${v}" selected>${v}</option>`;
        } else {
            html_string += `<option value="${v}">${v}</option>`;
        }
    });
    html_string += "</select></label>";

    e.innerHTML = html_string;

    let s = document.getElementById("affinity-select");
    s.addEventListener("input", () => {
        filter_links(parsed_data, Number(s.value));
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
    build_option(document.getElementById("plot-controls"));
}

//Set background so saved PNG has a background color.
const set_canvas_background = function() {
    let ctx = undefined;
    let canvas = document.getElementById("ballons");
    if (canvas === null) {
        console.log("done");
    } else {
        ctx = canvas.getContext('2d');  
        ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);    
    }
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
        set_canvas_background();
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
    let m = data.map(a => a.filter(d => d.length > 0)); //Clean extraneous line feeds.

    let link_groups = [new Set()]; //Use to group nodes into aggregated sets based on links.
    let json_data = {
        "nodes": [],
        "links": []
    };

    let ids = [];
    m.forEach((element, idx) => {
            json_data["nodes"].push({
                "id": String(idx + 1),
                "group": "No Group"
            });
            ids.push(String(idx + 1));   
    });
    m.forEach((element, idx) => {
        let source = String(idx + 1);
        element.forEach((e, i) => {
                let target = ids[i];
                let value = Number(e);
                if (source != target) {
                    score_set.add(value);
                    json_data["links"].push({
                        "source": source,
                        "target": target,
                        "value": value
                        });
                    }
                
            });
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

//REFACTOR THIS TO ONE MODULE
const clean_data = function(data) {
    let t_arr = data.split('\n');
    let arr = []
    t_arr.forEach(d => {
        if (d.length > 0) {
            arr.push(d.split('\t')); 
        }
    });
    return arr;
}

const affinity_page_init = function (init_obj) {
    let { guid_fn} = init_obj;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {

            parsed_data = parse_affinity_matrix(clean_data(e.detail.contents[0].data));
            score_array = [...score_set].sort((a, b) => a - b); //low to high unique affinity scores
            build_dom();
            filter_links(parsed_data, score_array[score_array.length - 1]);
        }
    });

    addEventListener("TreePlotRequest", e => {
//        if (FILE_NAME_REGEXP.test(e.detail.file_name)) {
            dispatchEvent(build_event("FileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
 //       }
    });

}

export { affinity_page_init }
