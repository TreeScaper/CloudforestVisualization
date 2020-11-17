import Plotly from 'plotly.js-basic-dist';
import { htmlToElement, cleanExistingPlot } from "./html_templates";

let event_build_fn = undefined;
let plateau_file = undefined;
let cd_results_file = undefined;
let coordinate_file = undefined; //TODO: Unclear what this coordinate file can be used for. This is an open question to Zhifeng. Grabbing and holding the file for future use.

const draw_graph = function (data) {
    const line_width = 2;
    let trace1 = {
        x: data["lambda"],
        y: data["label_community"],
        type: "lines+markers",
        name: "Labels for Communities",
        line: { width: line_width, color: "red" },
        hovertemplate: "<b>Community Labels: </b>%{y}<extra></extra>"
    }
    let trace2 = {
        x: data["lambda"],
        y: data["num_communities"],
        type: "lines+markers",
        name: "Number of Communities",
        yaxis: "y3",
        line: { width: line_width, color: "green" },
        hovertemplate: "<b>Num. Communities: </b>%{y}<extra></extra>"
    }
    let trace3 = {
        x: data["lambda"],
        y: data["modularity"],
        type: "lines+markers",
        name: "Modularity",
        yaxis: "y2",
        line: { width: line_width, color: "blue" },
        hovertemplate: "<b>Modularity: </b>%{y:.3f}<extra></extra>"
    }
    let trace_data = [trace1, trace2, trace3];
    let layout = {
        title: 'Community Detection',
        xaxis: {
            title: "Lambda", zeroline: false,
        },
        yaxis: { title: '', zeroline: false, color: "red" },
        yaxis2: {
            overlaying: 'y',
            side: 'right',
            color: "blue",
            showgrid: false,
            zeroline: false,
        },
        yaxis3: {
            overlaying: 'y',
            position: 0.03,
            color: "green",
            side: 'left',
            anchor: "free",
            showgrid: false,
            zeroline: false,
        },
    };
    let config = { responsive: true, displaylogo: false, scrollZoom: true }
    
    document.getElementById("plot").append(htmlToElement(`<div id="quality_graph"></div>`));
    Plotly.newPlot("quality_graph", trace_data, layout, config);
}


const parse_results = function (data) {
    let plot_data = {};
    plot_data["label_community"] = data[1].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["lambda"] = data[3].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["num_communities"] = data[5].splice(1).map(v => Number(v.trim()));
    plot_data["modularity"] = data[7].splice(1).map(v => Number(v.trim()));
    return plot_data;
}

//REFACTOR THIS TO MODULE
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

/**
 *  CD plateaus can be computed for bipartitions or trees. 
 *  
 *  Here we parse a JSON object of data into on ordered JSON object
 *  containing communitues per tree/bipartition for each range of calculation bounds
 * 
 * @param {*} raw_data CD plateau results in JSON format 
 */
const parse_plateau_data = function(raw_data) {
    let data = raw_data.data;
    let header = raw_data.header;
    let file_name = raw_data.fileName;
    let ret_val = {};
    ret_val.file_name = file_name;
    ret_val.node_type = header.node_type;
    ret_val.cd_bounds = [];

    let data_lines = data.split('\n').filter(v => v.length > 0);
    data_lines.forEach((l, i) => {
        let values = l.split('\t').filter(v => v.length > 0);
        if (i === 0) {
            values.slice(1).forEach(e => {
                ret_val.cd_bounds.push({
                    'cd_by_node': {}
                });
            });
        }
        if (i === 6) {
            //noop
        }
        if (i < 6) {
            values.slice(1).forEach((v,idx) => {
                ret_val.cd_bounds[idx][values[0]] = Number(v);
            });
        }
        if (i > 6) {
            values.slice(1).forEach((v, idx) => {
                ret_val.cd_bounds[idx].cd_by_node[values[0]] = v;
            });
        }
        
    });
    return ret_val;
}

/**
 * Nodes into groups, then run basic stats on the grouping.
 * Add this as properties directly to the p_obj.
 * @param {*} p_obj 
 */
const plateau_stats = function (p_obj) {
    p_obj.cd_bounds.forEach(b => {
        b.group_keys = {};
        Object.values(b.cd_by_node).forEach(v => {
          b.group_keys[v] = [];
        }); 
        Object.keys(b.cd_by_node).forEach(k => {
          b.group_keys[b.cd_by_node[k]].push(k);
        });
        let arr = [];
        Object.keys(b.group_keys).forEach(k => {
            arr.push(b.group_keys[k].length);
        });
        b.avg_nodes_per_group = arr.reduce((a, b) => (a + b)) / arr.length;
        b.number_of_groups = arr.length;
    });
}

const present_plateaus = function(p_obj) {
    cleanExistingPlot();
    let s = `<div class="tile is-ancestor">
        <div class="tile is-parent is-vertical">
            <div class="tile is-child">
                <h3>CD Grouping for ${p_obj.node_type}s by Plateau Bounds</h3>
                <div id="group-msg" class="has-text-success"></div>
            </div>`;
    
    p_obj.cd_bounds.forEach((bound, idx) => {
        s += `<div class="tile is-child box">
        <div class="columns">
        <div class="column is-one-fifth"><button value="${idx}" class="button is-light grouping-command">Use in Plotting</button></div>
        <div class="column">
        <p>Start LB: ${bound["startLB:"]} End LB: ${bound["endLB:"]}</p>
        <p>Start UB: ${bound["startUB:"]} End UB: ${bound["endUB:"]}</p>
        <p>Number of Groups: ${bound.number_of_groups}</p>
        <p>Avg nodes per Group: ${bound.avg_nodes_per_group.toFixed(4)}</p>
        </div>
        </div>
        </div>`;
    });
    s += `</div></div>`;
    document.getElementById("plot").append(htmlToElement(s));

    //Wire the buttons
    document.querySelectorAll('.grouping-command').forEach(n => {
        n.addEventListener('click', evt => {
            let offset = evt.target.getAttribute('value');
            let msg = `Using the ${p_obj.cd_bounds[offset].number_of_groups} groups in bound ${Number(offset) + 1} for plotting.`;
            let e = document.getElementById('group-msg');
            e.innerHTML = msg;

            let node_type = p_obj.node_type;
            let cd_grouping = p_obj.cd_bounds[offset].cd_by_node;
            let evt_title = `CDBy${node_type}`; //CDByTree or CDByBipartition
            dispatchEvent(event_build_fn(evt_title, {groups: cd_grouping}));
        });
    });

} 

const plot_community_detection = function() {
    //Step 1: Prepare plateau data for presentaiton
    //  - Stats of grouping: Number of groups, avg nodes per group, SD nodes per group.
    let parsed_data = parse_plateau_data(plateau_file);
    plateau_stats(parsed_data);
    present_plateaus(parsed_data);
    
    //Step 2: Prepare the lambda/modularity data
    let lambda_data = parse_results(clean_data(cd_results_file.data));
    draw_graph(lambda_data);
}

const community_detection_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {

            e.detail.contents.forEach(entry => {
                if (RegExp(/CD Plateaus/i).test(entry.fileName)) {
                    plateau_file = entry;
                }
                if (RegExp(/CD with NLDR Coordinates/i).test(entry.fileName)) {
                    coordinate_file = entry;
                }
                if (RegExp(/CD Results/i).test(entry.fileName)) {
                    cd_results_file = entry;
                }
            });
            plot_community_detection();
        }
    });

    addEventListener("CDFiles", e => {      
        if (plateau_file) {
            plot_community_detection();
        } else {    
            let plateau_file_obj = e.detail.files.filter(obj => RegExp(/CD Plateaus/i).test(obj.name));
            let coordinate_file_obj = e.detail.files.filter(obj => RegExp(/CD with NLDR Coordinates/i).test(obj.name));
            let cd_results_file_obj = e.detail.files.filter(obj => RegExp(/CD Results/i).test(obj.name));
            
            dispatchEvent(event_build_fn("FileContentsRequest", {
                guid: my_guid,
                files: [plateau_file_obj[0].id, coordinate_file_obj[0].id, cd_results_file_obj[0].id]
            }));
        }
    });

    addEventListener("CDPlotRequest", e => {
        dispatchEvent(event_build_fn("CDFilesRequest", {guid: my_guid}));
    });
}

export { community_detection_init }