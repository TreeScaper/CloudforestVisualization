import Plotly from 'plotly.js-basic-dist';
import { htmlToElement, cleanExistingPlot } from "./html_templates";

let event_build_fn = undefined;
let cd_grouping = undefined;
let using_groups = false;
let cd_type = undefined; //Trees || Cova

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
    dispatchEvent(event_build_fn("UseCDGroupsTrue", { groups: filtered_data, type: cd_type }));
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

const community_detection_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            //let key = Object.keys(e.detail.contents).filter(k => RegExp(/[Cc]ommunity/).test(k));
            //key = "Community Results:Trees"
            //cd_type = key[0].split(":")[1]; //hope this is a temp kludge around CLVTreescaper output issue
            //let parsed_data = parse_results(e.detail.contents[key[0]]);
            let parsed_data = parse_results(clean_data(e.detail.contents[0].data));
            build_dom();
            draw_graph(parsed_data);
            let raw_cds = parse_communities(e.detail.contents[key[0]], parsed_data["label_community"]);
            let grouped_groups = group_groups(raw_cds);
            show_cd_groups(grouped_groups);
        }
    });

    addEventListener("CDPlotRequest", e => {
        dispatchEvent(event_build_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
    });
}

export { community_detection_init }