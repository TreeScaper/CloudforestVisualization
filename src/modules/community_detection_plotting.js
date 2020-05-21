import Plotly from 'plotly.js-basic-dist';
import { htmlToElement, cleanExistingPlot } from "./html_templates";

let event_buld_fn = undefined;


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
        title: 'Community Information for Covariance Matrix',
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

const build_dom = function () {
    cleanExistingPlot();
}


/**
 * Community index (first column is tree index): <==== idx 8
0	0	0	0	0	0	0	0	0	0	0	0	
1	0	0	0	0	0	0	0	0	0	0	1	
2	0	0	0	1	3	3	3	3	3	3	2	
3	0	0	0	0	0	0	0	0	0	0	3	
4	0	0	0	3	1	1	1	1	1	1	4	
5	0	0	0	3	1	1	1	1	1	1	5	
6	0	0	0	0	0	0	0	0	0	0	6	
7	0	0	7	1	5	5	5	5	5	5	7	
8	0	1	5	5	2	2	2	2	2	2	8	
9	0	1	5	6	12	12	12	12	12	12	9	
10	0	0	0	7	4	4	4	4	4	4	10	
11	0	0	7	7	14	14	14	14	14	14	11	
12	0	0	0	0	0	0	0	0	0	0	12	
13	0	0	0	0	0	0	0	0	0	0	13	
 * 
 */
const parse_communities = function (data) {
    const communities = data.map((arr, idx) => {
        if (idx > 8) {
            let vals = arr.map(v => Number(v));

        }
    });
}

const parse_results = function (data) {
    let plot_data = {};
    plot_data["label_community"] = data[1].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["lambda"] = data[3].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["num_communities"] = data[5].splice(1).map(v => Number(v.trim()));
    plot_data["modularity"] = data[7].splice(1).map(v => Number(v.trim()));
    return plot_data;
}

const community_detection_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_buld_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            let key = Object.keys(e.detail.contents).filter(k => RegExp(/[Cc]ommunity/).test(k));
            let parsed_data = parse_results(e.detail.contents[key[0]]);
            build_dom();
            draw_graph(parsed_data);
        }
    });

    addEventListener("CDPlotRequest", e => {
        dispatchEvent(event_buld_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
    });
}

export { community_detection_init }