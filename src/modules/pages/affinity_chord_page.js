import { scaleSequential } from "d3-scale";
import { interpolatePiYG } from "d3-scale-chromatic";
import { forceSimulation, forceCollide, forceManyBody, forceX, forceY } from "d3-force";
import { select, event } from "d3-selection";
import { drag } from "d3-drag";
import { htmlToElement, cleanExistingPlot } from '../utilities/html_templates';
import { isNull } from "plotly.js-gl2d-dist";
import { build_event } from "../utilities/support_funcs";
import { get_file_contents } from "../data_manager";

// Percentile threshold for affinity value
const threshold = .001;

let cd_data = undefined;
let affinity_data = undefined;

/*
   Splits data by newline, and tabulates rows.
*/
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

/*
 * Parses the following information from community detection results file:
 *   - label community
 *   - lambda value
 *   - Value of modularity
 *   - Number of communities
 *   - Community maps
 *
 * The first four entries in the returned object each are an array with an entry for
 * each separate set of parameters community detection was run for.
 *
 * For example, if lambda.length = 112, plot_data['lambda'][10] = 0.25, and
 * plot_data['num_communities'] = 5, then the input data has results for 112 different
 * values of lambda, and when run with lambda = 0.25, 5 communities were detected.
 *
 * The community maps output is an array with length equaling the number of trees that
 * were used in community detection. For each tree, there is an array similar to the other
 * outputs where each entry is the community that tree was put into for the associated
 * value of lambda.
 *
 * So, plot_data['community_maps'][27][10] = 32 means the 28th tree was in community 32
 * when cd was run with plot_data['lambda'][10].
 */
const parse_cd_results = function (data) {
    let plot_data = {};
    plot_data["label_community"] = data[1].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["lambda"] = data[3].splice(1).filter(f => f.length > 0).map(v => Number(v.trim()));
    plot_data["num_communities"] = data[5].splice(1).map(v => Number(v.trim()));
    plot_data["modularity"] = data[7].splice(1).map(v => Number(v.trim()));
    plot_data["community_maps"] = [...Array(plot_data["lambda"].length - 1).keys()].map( function(i) {
        return data.slice(9).map(r => r[i + 1]);
    });

    return plot_data;
}

/*
 * Parses out from community detection results an array with each element
 * representing a cluster as an array of member nodes.
 */
const parse_clusters_from_cd = function(community_map) {
    let max_cluster = Math.max(...community_map);
    let clusters = [];

    for (let i = 0; i < Number(max_cluster)+1; i++) {
        clusters.push([]);
    }

    for (let i = 0; i < community_map.length; i++) {
        let cluster = community_map[i];
        clusters[cluster].push(i);
    }
    return clusters;
}

/*
 * Parses affinity matrix data
 */
const parse_affinity_matrix = function (data) {
    //Clean extraneous line feeds.
    let m = data.map(a => a.filter(d => d.length > 0));

    //Use to group nodes into aggregated sets based on links.
    let link_groups = [new Set()];
    let json_data = {
        "nodes": [],
        "links": []
    };

    // Find the first line with actual data
    let matrix_start_index = 0;
    for (let idx = 0; idx < m.length; idx++){
            let element = m[idx];
            if (element == ">") {
                    matrix_start_index = idx + 1;
                    break;
            }
    }

    let all_scores_thresh = [];

    // Size of square matrix
    //const matrix_size = m.length - matrix_start_index;
    const matrix_size = 1188;

    // Create empty matrix
    let matrix = Array(matrix_size).fill().map(()=>Array(matrix_size).fill());

    // Parse out matrix. Diagonal values are zeroed.
    for (let i = 0; i < matrix_size; i++) {
            const element = m[matrix_start_index + i];
            for (let j = 0; j < element.length; j++) {
                    if (i == j || Number(element[j]) < threshold) {
                        matrix[i][j] = 0;
                    } else {
                        all_scores_thresh.push(Number(element[j]));
                        matrix[i][j] = Number(element[j]);
                    }
                    matrix[j][i] = matrix[i][j];
            }
    }

    // IDs of trees
    let ids = [];

    // Parse out IDs and create node entry for each tree
    m.slice(matrix_start_index).forEach((element, idx) => {
            json_data["nodes"].push({
                "id": String(idx + 1),
                "group": "No Group"
            });
            ids.push(String(idx + 1));
    });

    // Will contain all affinity scores found in the matrix
    let score_set = new Set();

    // Create links data structure. Each entry is a weighted edge in
    // the graph, with source, target, and value.
    m.slice(matrix_start_index).forEach((element, idx) => {
        let source = String(idx + 1);
        element.forEach((e, i) => {
            let target = ids[i];
            let value = Number(e);
            if (source != target) {
                // Add score to set of all scores
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

    // Create array from sorted score set
    let score_array = [...score_set].sort((a, b) => a - b); //low to high unique affinity scores

    // Return network matrix (with zeroed diagonal), sorted scores, and json_data, which
    // includes the list of nodes and their groups, and the list of links.
    return [matrix, score_array, json_data];
}

/*
 *  Unnamed clustering algorithm.
 *
 *  Checks if the source or target of an existing edge already exist in a cluster.
 *  If so, both are added to the given cluster. Otherwise, a new cluster is
 *  created with each.
 */
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

/*
 * Filters and clusters nodes by affinity
 */
const filter_links = function (data, threshold) {

    // Filter out edges with affinity below a certain threshold
    let filter_links = data.links.filter(l => l.value >= threshold);
    let link_groups = [new Set()];
    let filter_nodes = data.nodes.map(n => {
        return {
            id: n.id,
            group: n.group
        };
    }); //need a deep copy.

    // Run clustering on nodes
    filter_links.forEach(l => {
        aggregate_test(l.source, l.target, link_groups)
    });

    // set group id for nodes based on aggregation
    filter_nodes.forEach(n => {
        link_groups.forEach((g, idx) => {
            for (let item of g) {
                if (n.id === item) {
                    n["group"] = String(idx);
                }
            }
        });
    });

    return [filter_nodes, filter_links];
}

/*
 * Removes nodes from a matrix that fall below a certain percentile
 * of aggregate affinity (all affinities for the node summed). The
 * percentile is given as the lower fraction of nodes to remove,
 * threshold_frac = 0.2 removes the lowest 20% of nodes.
 */
function remove_low_aff_trees(m, threshold_frac) {
    affinity_sums = [];
    for (let i = 0; i < m.length; i++) {
        let r = m[i];
        affinity_sums.push([i, r.reduce((a, b) => a + b, 0)]);
    }
    affinity_sums.sort((a, b) => b[1] - a[1]);
    let min_index = (1-threshold_frac) * affinity_sums.length;
    let low_affinity_sums = affinity_sums.slice(min_index);

    low_affinity_sums.sort((a, b) => b[0] - a[0]);

    // Remove trees that had low affinity scores
    low_affinity_sums.forEach(function(e) {
        m.splice(e[0], 1);
        for (let i = 0; i < m.length; i++) {
            m[i].splice(e[0], 1);
        }
    });
}

/*
 * Generates a list of edges from a graph
 */
function get_links(m) {
    let links = [];
    for (let i = 0; i < m.length; i++) {
        let r = m[i];
        for (let j = 0; j < r.length; j++) {
            links.push({"source": i, "target": j, "value": m[i][j]});
        }
    }
    return links;
}

/*
 * Normalize a matrix
 */
function normalize_matrix (a, min, max) {
    let diff = max - min;
    for (let i = 0; i < a.length; i++) {
        let r = a[i];
        for (let j = 0; j < r.length; j++) {
            if (a[i][j] != 0) {
                let normalized = (a[i][j] - min) / diff;
                a[i][j] = normalized;
            }
        }
    }
}

/*
 * Find mean affinity in a cluster
 */
const mean_affinity_function = function (source_cluster, target_cluster, network_matrix) {
     // Sum of affinities between nodes from the source cluster to the target cluster
     let total_affinity = 0;

     // Total number of affinities summed
     let total_edges = 0;

     // Iterate through each node in the source cluster
     for (let i = 0; i < source_cluster.length; i++) {
         let node = source_cluster[i];

         // Get the row of affinities for this element
         let node_affinities = network_matrix[node];

         // Iterate through each affinity id, which correspond to the index
         // of the matrix row.
         for (let j = 0; j < node_affinities.length; j++) {

             // If that id is in the target cluster, add the affinity and increment
             // the numbrer of edges summed.
             if (j in target_cluster) {
                 total_edges++;
                 total_affinity += node_affinities[j];
             }
         }
     }

     // The weight is the mean of the affinities of the edges
     let weight = total_affinity/total_edges;

     // This is needed to avoid the NaN resulting from divide by zero
     if (total_affinity == 0) {
         weight = 0;
     }

     return weight;
}

/*
 * Generate a network from clustered nodes.
 * A new edge will be drawn between each cluster,
 * with the clusters themselves representing nodes in a new network.
 */
const create_cluster_network = function(clusters, network_matrix, affinity_function) {
    let cluster_mat = [];
    for (let i = 0; i < clusters.length; i++) {

        // Source cluster
        let source_cluster = clusters[i];

        // Row representing the new node
        let cluster_mat_row = [];

        for (let j = 0; j < clusters.length; j++) {
            // Target cluster
            let target_cluster = clusters[j];

            let weight = affinity_function(source_cluster, target_cluster, network_matrix);

            // Add the weight as an edge in the new matrix
            cluster_mat_row.push(weight);
        }

        // Add the row for the source cluster as a node in the new network
        cluster_mat.push(cluster_mat_row);
    }
    return cluster_mat;
}

/*
 * Creates a d3 chord plot given an affinity matrix.
 *
 * WAGNERR: This function needs some work.
 */
const chord_plot = function (matrix) {
    cleanExistingPlot();
    let plot_div = document.getElementById("plot");
    let doc_width = plot_div.clientWidth;
    let div_width = Math.floor((doc_width - (doc_width * .15)) / 100) * 100;
    let div_height = div_width / 2;
    plot_div.append(htmlToElement(`<div id="chart"></div>`));
    plot_div.append(htmlToElement(`<div id="tooltip"></div>`));

    // Create d3 svg object
    var svg = d3.select("#chart")
      .append("svg")
        .attr("width", 500)
        .attr("height", 500)
      .append("g")
        .attr("transform", "translate(220,220)")

    // Make sure diagonal of matrix is zero, since we don't want to represent the affinity of a node
    // with itself.
    for (let i = 0; i < matrix.length; i++) {
        matrix[i][i] = 0;
    }


    // give this matrix to d3.chord(): it will calculates all the info we need to draw arc and ribbon
    var res = d3.chord()
        .padAngle(0.01)     // padding between entities (black arc)
        .sortSubgroups(d3.descending)
        (matrix)

    // Generates colors distributed equally over the rainbow for the each group
    let index_colors = {};
    for (let i = 0; i < res.groups.length; i++) {
        let e = res.groups[i];
        if (!(e.index in index_colors)) {
           index_colors[e.index] = 40 + e.index * (320 / matrix.length);
        }
    }

    var tooltip = d3.select("#chart")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("position", "absolute");

    var showLinkTooltip = function(d) {
        tooltip
            .style("opacity", 1)
            .html("Source: " + d.srcElement.__data__.source.index + "<br>Target: " + d.srcElement.__data__.target.index + "<br>Affinity: " + matrix[d.srcElement.__data__.source.index][d.srcElement.__data__.target.index])
            .style("left", (d.clientX + 15) + "px")
            .style("top", (d.clientY - 28) + "px")
    }

    var showGroupTooltip = function(d) {
        tooltip
            .style("opacity", 1)
            .html("Cluster index: " + d.srcElement.__data__.index)
            .style("left", (d.clientX + 15) + "px")
            .style("top", (d.clientY - 28) + "px")
    }

    var hideTooltip = function(d) {
        tooltip
        .transition()
        .duration(5000)
        .style("opacity", 0)
    }

    // Add groups on the inner part of the circle
    svg
      .datum(res)
      .append("g")
      .selectAll("g")
      .data(function(d) { return d.groups; })
      .enter()
      .append("g")
      .append("path")
      .style("fill", function(d, i) {
          let color = parseInt(index_colors[d.index]);
          if (isNaN(color)) {
              color = 0;
          }
          return "hsl(" + color + "," + 50 + "%," + 50 + "%)"})
      .style("stroke", "black")
      .attr("d", d3.arc()
        .innerRadius(200)
        .outerRadius(210))
      .on("mouseover", showGroupTooltip );
      //.on("mouseleave", hideTooltip );

    // Add links between groups
    svg
      .datum(res)
      .append("g")
      .selectAll("path")
      .data(function(d) { return d; })
      .enter()
      .append("path")
          .attr("d", d3.ribbon()
          .radius(200)
        )
      .style("stroke", "black")
      .style("fill", function(d, i) {
          let color = parseInt(index_colors[d.source.index]);
          if (isNaN(color)) {
              color = 0;
          }
          return "hsl(" + color + "," + 50 + "%," + 50 + "%)"
          })
      .on("mouseover", showLinkTooltip );
      //.on("mouseleave", hideTooltip );

    // Add the ticks
    svg
        .selectAll(".group-tick")
        .data(function(d) { return groupTicks(d, 25); })    // Controls the number of ticks: one tick each 25 here.
        .enter()
        .append("g")
        .attr("transform", function(d) { return "rotate(" + (d.angle * 180 / Math.PI - 90) + ") translate(" + 200 + ",0)"; })
        .append("line")               // By default, x1 = y1 = y2 = 0, so no need to specify it.
        .attr("x2", 6)
        .attr("stroke", "black")

    //// Add the labels of a few ticks:
    //group
    //    .selectAll(".group-tick-label")
    //    .data(function(d) { return groupTicks(d, 25); })
    //    .enter()
    //    .filter(function(d) { return d.value % 25 === 0; })
    //    .append("g")
    //    .attr("transform", function(d) { return "rotate(" + (d.angle * 180 / Math.PI - 90) + ") translate(" + 200 + ",0)"; })
    //    .append("text")
    //    .attr("x", 8)
    //    .attr("dy", ".35em")
    //    .attr("transform", function(d) { return d.angle > Math.PI ? "rotate(180) translate(-16)" : null; })
    //    .style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
    //    .text(function(d) { return d.value })
    //    .style("font-size", 9)


    // Returns an array of tick angles and values for a given group and step.
    function groupTicks(d, step) {
        var k = (d.endAngle - d.startAngle) / d.value;
        return d3.range(0, d.value, step).map(function(value) {
            return {value: value, angle: value * k + d.startAngle};
        });
    }
}

/*
 * Initialize event listeners.
 */
const affinity_chord_page_init = function () {

    let file_contents_callback = (contents) => {
        contents.forEach(entry => {
            if (RegExp(/CD Results/i).test(entry.fileName)) {
                cd_data = entry;
            }
            if (RegExp(/Affinity Matrix/i).test(entry.fileName)) {
                affinity_data = entry;
            }
        });

        // Clean and parse community detection data
        let cd_data_parsed = parse_cd_results(clean_data(cd_data.data));

        // Choosing communities from arbitrary lambda value
        let cd_clusters = parse_clusters_from_cd(cd_data_parsed['community_maps'][38]);

        // Parse affinity matrix
        let [matrix, score_array, parsed_data] = parse_affinity_matrix(clean_data(affinity_data.data));
        // Run clustering
        let [fnodes, flinks] = filter_links(parsed_data, score_array[score_array.length - 50]);

        // Find the number of clusters in the output cluster data
        let nclusters = 0;
        for (let i = 0; i < fnodes.length; i++) {
            let cnum = parseInt(fnodes[i].group);
            if (cnum > nclusters) {
                nclusters = cnum;
            }
        }

        // Reorganize clusters. Each element represents a cluster, and contains
        // the member nodes of that cluster.
        let clusters = [];
        for (let i = 0; i < nclusters; i++) {
            let in_nodes = [];
            for (let k = 0; k < fnodes.length; k++) {
                if (fnodes[k].group == i + 1) {
                    in_nodes.push(fnodes[k].id);
                }
            }
            clusters.push(in_nodes);
        }

        // Get maximum and minimum scores. Useful for normalizing matrix.
        let max_score = score_array.filter(d => !isNaN(d)).at(-1);
        let min_score = score_array.filter(d => d > threshold)[0];

        // Normalize affinity matrix
        normalize_matrix(matrix, min_score, max_score);


        //let cluster_mat = create_cluster_network(clusters);

        // Create the matrix of cluster affinities for d3.
        // WAGNERR zero diagonal of this matrix
        let cluster_mat = create_cluster_network(cd_clusters, matrix, mean_affinity_function);
        chord_plot(cluster_mat);

    };

    addEventListener("AffinityPageRequest", e => {
        get_file_contents(Object.keys(e.detail.file_ids).map(k => e.detail.file_ids[k]), file_contents_callback);
    });
}


export { affinity_chord_page_init }
