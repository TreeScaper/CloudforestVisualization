import Plotly, { redrawReglTraces } from 'plotly.js-basic-dist';
import { htmlToElement, cleanExistingPlot } from "./html_templates";

let event_build_fn = undefined;
let cd_grouping = undefined;
let using_groups = false;

let plateau_file = undefined;
let coordinate_file = undefined;
let cd_results_file = undefined;


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
    Plotly.newPlot("plot", trace_data, layout, config);
    let myPlot = document.getElementById("plot");
    myPlot.on('plotly_click', function (data) {
        console.log(data.points[0].y);
    });
}

// Generate bar graph showing distribution of trees among groups
const show_cd_groups = function (groups) {
    let sortable = [];
    Object.keys(groups).forEach(k => {
        sortable.push([k, groups[k]]);
    })
    sortable.sort((a, b) => { return b[1].length - a[1].length })

    document.getElementById("group-count").setAttribute("min", sortable[sortable.length -1 ][1].length);
    document.getElementById("group-count").setAttribute("max", sortable[0][1].length);
    document.getElementById("group-count").setAttribute("value", sortable[0][1].length);

    cd_grouping = sortable;

    let x_data = [];
    let y_data = [];
    let colors = [];
    sortable.forEach(vals => {
        x_data.push(`Group ${vals[0]}`);
        y_data.push(vals[1].length);
        colors.push("blue");
    });
    let data = [
        {
            x: x_data,
            y: y_data,
            type: 'bar',
            marker: {color: colors}
        }
    ];
    let grp_plot = document.getElementById("plot-controls");
    Plotly.newPlot("plot-controls", data, {
        title: "Count by CD Group",
        xaxis: {
            tickangle: -45
        },
    });

    grp_plot.on("plotly_click", function(data){
        let pn='',
            tn='',
            colors=[];
        for(var i=0; i < data.points.length; i++){
            pn = data.points[i].pointNumber;
            tn = data.points[i].curveNumber;
            colors = data.points[i].data.marker.color;
        };
        colors[pn] = '#C54C82';

        let update = {'marker':{color: colors}};
        Plotly.restyle('plot-controls', update, [tn]);
    });
}

const dispatch_use_groups = function() {
    let filter_count = Number(document.getElementById("group-count").value);
    let filtered_data = cd_grouping.filter(obj => obj[1].length >= filter_count);
    dispatchEvent(event_build_fn("UseCDGroupsTrue", { groups: filtered_data }));
    using_groups = true;
}

const build_dom = function () {
    cleanExistingPlot();
    let e = document.getElementById("plot-metadata");
    e.append(htmlToElement(`<input type="checkbox" id="use-cd" name="use-cd">`));
    e.append(htmlToElement(`<label for="use-cd">Use CD grouping where count &ge;</label>`));
    e.append(htmlToElement(`<input type="number" id="group-count" name="group-count" style="width: 5em;" min="1">`));
    if (using_groups) {
        document.getElementById("use-cd").checked = true;
    }
    document.getElementById("use-cd").addEventListener('input', (e) => {
        console.log(`Use CD ${e.target}`);
        if (e.target.checked) {
            dispatch_use_groups();
        } else {
            dispatchEvent(event_build_fn("UseCDGroupsFalse", {}));
            using_groups = false;
        }
    });
}

// Returns an array of index offsets showing where the community ids are.
const get_cd_indexes = function (arr) {
    let d = {};
    arr.forEach((cv, idx) => {
        if (!(cv in d)) {
            d[cv] = [];
        }
        d[cv].push(idx + 1); //the data line for num of communities has been sliced before this step.
    });
    let cd_idxs = Object.keys(d).filter(k => {
        if (k > 0 && d[k].length > 2) {
            return k
        }
    })
    return d[Math.min(...cd_idxs)];
}

const parse_communities = function (data, labels) {
    let cd_indexes = get_cd_indexes(labels);
    let communities = {};
    data.forEach((arr, idx) => {
        if (idx > 8) {
            let cds = [];
            cd_indexes.forEach(i => { cds.push(arr[i]) });
            communities[arr[0]] = cds;
        }
    });
    //sanity check
    Object.keys(communities).forEach(k => {
        if (!(Math.min(...communities[k]) === Math.max(...communities[k]))) {
            console.error(`All values for ${k} should be equal, they are not --> ${communities[k]}`);
        }
    });
    return communities;
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
 * Clean the raw grouping to k<group number> : v< [tree_num, tree_num, ...] >
 * @param {{}} cd_obj 
 */
const group_groups = function (cd_obj) {
    let clean_groups = {};
    Object.keys(cd_obj).forEach(k => {
        let tree_num = Number(k) + 1;
        let group_num = Number(cd_obj[k][0]);

        if (!(group_num in clean_groups)) {
            clean_groups[group_num] = [];
        }

        clean_groups[group_num].push(tree_num);
    });
    return clean_groups;
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
            </div>`;
    
    p_obj.cd_bounds.forEach(bound => {
        s += `<div class="tile is-child box">
        <div class="columns">
        <div class="column is-one-fifth"><button class="button is-light">Use in Plotting</button></div>
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
} 

const plot_community_detection = function() {
    //Step 1: Prepare plateau data for presentaiton
    //  - Stats of grouping: Number of groups, avg nodes per group, SD nodes per group.
    let parsed_data = parse_plateau_data(plateau_file);
    plateau_stats(parsed_data);
    present_plateaus(parsed_data);
    //let parsed_data = parse_results(clean_data(e.detail.contents[0].data));
    //build_dom();
    //draw_graph(parsed_data);
    // let raw_cds = parse_communities(clean_data(e.detail.contents[0].data), parsed_data["label_community"]);
    // let grouped_groups = group_groups(raw_cds);
    // show_cd_groups(grouped_groups); 
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