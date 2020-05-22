import Plotly from 'plotly.js-basic-dist';
import { htmlToElement, cleanExistingPlot } from "./html_templates";

let event_build_fn = undefined;
let cd_grouping = undefined;

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
    let e = document.getElementById("plot-metadata");
    e.append(htmlToElement(`<input type="checkbox" id="use-cd" name="use-cd">`));
    e.append(htmlToElement(`<label for="use-cd">Use CD grouping in all plots.</label>`));

    document.getElementById("use-cd").addEventListener('input', (e) => {
        console.log(`Use CD ${e.target}`);
        if (e.target.checked) {
            dispatchEvent(event_build_fn("CDGroupsAvailable", { groups: cd_grouping }));
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
    return d[Math.min(cd_idxs)];
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

const community_detection_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            let key = Object.keys(e.detail.contents).filter(k => RegExp(/[Cc]ommunity/).test(k));
            let parsed_data = parse_results(e.detail.contents[key[0]]);
            build_dom();
            draw_graph(parsed_data);
            cd_grouping = parse_communities(e.detail.contents[key[0]], parsed_data["label_community"]);
        }
    });

    addEventListener("CDPlotRequest", e => {
        dispatchEvent(event_build_fn("FileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
    });
}

export { community_detection_init }